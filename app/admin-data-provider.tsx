'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { CatalogProduct } from '@/lib/catalog-types';
import { mapProductRows, type ProductRow } from '@/lib/catalog-mapper';
import {
  defaultSiteSettings,
  mergeSiteSettings,
  currentStoreDate,
  SITE_SETTINGS_TABLE,
  type SiteSettings,
} from '@/lib/site-settings';
import { isMissingRelationError } from '@/lib/supabase-errors';
import { getFlyerMimeType } from '@/lib/flyer-file';
import { usePathname } from 'next/navigation';

function resolveOfferEndsAt(dataFim: string): string {
  const trimmed = String(dataFim).trim();
  const isoCandidate = trimmed.includes('T')
    ? trimmed
    : `${trimmed.slice(0, 10)}T23:59:59.999-03:00`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime())
    ? new Date(`${trimmed.slice(0, 10)}T23:59:59.999-03:00`).toISOString()
    : parsed.toISOString();
}

export interface AdminOffer {
  id: string;
  productId: string;
  normalPrice: number;
  promoPrice: number;
  startsAt: string;
  endsAt: string;
}

export interface AdminFlyer {
  id: string;
  title: string;
  validUntil: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
}

interface AdminDataContextValue {
  data: { flyer: AdminFlyer | null; flyers: AdminFlyer[] };
  selectFlyer: (id: string) => void;
  updateFlyers: (flyers: AdminFlyer[]) => void;
  products: CatalogProduct[] | null;
  settings: SiteSettings;
  settingsReady: boolean;
  updateSettings: (settings: SiteSettings) => void;
}

const AdminDataContext = createContext<AdminDataContextValue>({
  data: { flyer: null, flyers: [] },
  selectFlyer: () => undefined,
  updateFlyers: () => undefined,
  products: null,
  settings: defaultSiteSettings,
  settingsReady: false,
  updateSettings: () => undefined,
});

export function AdminDataProvider({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings?: SiteSettings;
}) {
  const [flyers, setFlyers] = useState<AdminFlyer[]>([]);
  const [selectedFlyerId, setSelectedFlyerId] = useState('');
  const [liveProducts, setLiveProducts] = useState<CatalogProduct[] | null>(
    null,
  );
  const [settings, setSettings] = useState<SiteSettings>(
    initialSettings ?? defaultSiteSettings,
  );
  const [settingsReady, setSettingsReady] = useState(Boolean(initialSettings));
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const refreshFlyers = () => {
      void supabaseBrowser
        .from('encartes')
        .select('id, titulo, validade, arquivo_url, arquivo_nome')
        .gte('validade', currentStoreDate())
        .order('atualizado_em', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            if (isMissingRelationError(error)) {
              if (active) setFlyers([]);
              return;
            }
            console.error('Não foi possível carregar os encartes publicados.', error);
            return;
          }
          if (active) {
            setFlyers(
              (data ?? []).map((row) => ({
                id: String(row.id),
                title: String(row.titulo ?? ''),
                validUntil: String(row.validade ?? '').slice(0, 10),
                fileName: String(row.arquivo_nome ?? ''),
                fileType: getFlyerMimeType(String(row.arquivo_nome ?? '')),
                fileSize: 0,
                fileUrl: row.arquivo_url ? String(row.arquivo_url) : undefined,
              })),
            );
          }
        });
    };
    refreshFlyers();
    window.addEventListener('flyers-changed', refreshFlyers);
    const flyersChannel = supabaseBrowser
      .channel('public-flyers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encartes' },
        refreshFlyers,
      )
      .subscribe();
    return () => {
      active = false;
      window.removeEventListener('flyers-changed', refreshFlyers);
      void supabaseBrowser.removeChannel(flyersChannel);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshProducts = () => {
      void Promise.all([
        supabaseBrowser
          .from('produtos')
          .select(
            'id, nome, descricao, categoria, preco_normal, preco_oferta, imagem_url, unidade, marca, selo, tabloide_pagina, restricoes_json, estoque, ativo',
          )
          .order('nome')
          .returns<ProductRow[]>(),
        supabaseBrowser
          .from('ofertas_relampago')
          .select('produto_id, preco_promocional, data_inicio, data_fim')
          .order('data_inicio', { ascending: false }),
      ]).then(([productsRes, offersRes]) => {
        if (!active || productsRes.error) return;
        const mapped = mapProductRows(
          (productsRes.data ?? []).filter((row) => row.ativo),
        );
        const offers = offersRes.error ? [] : (offersRes.data ?? []);
        const today = currentStoreDate();
        const enriched = mapped.map((product) => {
          const productOffers = offers.filter(
            (offer) => String(offer.produto_id) === product.id,
          );
          const activeOffer = productOffers.find((offer) => {
            const startDay = String(offer.data_inicio).slice(0, 10);
            const endDay = String(offer.data_fim).slice(0, 10);
            return startDay <= today && endDay >= today;
          });
          if (activeOffer) {
            return {
              ...product,
              price: Number(activeOffer.preco_promocional),
              oldPrice: Number(product.oldPrice ?? product.price),
              flashOfferEndsAt: resolveOfferEndsAt(String(activeOffer.data_fim)),
            };
          }
          const matchesExpiredFlashOffer = productOffers.some(
            (offer) =>
              Math.abs(Number(offer.preco_promocional) - product.price) < 0.005,
          );
          if (matchesExpiredFlashOffer) {
            return {
              ...product,
              price: Number(product.oldPrice ?? product.price),
              oldPrice: null,
              flashOfferEndsAt: undefined,
            };
          }
          return product;
        });
        setLiveProducts(enriched);
      });
    };

    refreshProducts();
    window.addEventListener('catalog-products-changed', refreshProducts);
    const catalogChannel = supabaseBrowser
      .channel('public-catalog-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        refreshProducts,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ofertas_relampago' },
        refreshProducts,
      )
      .subscribe();

    return () => {
      active = false;
      window.removeEventListener('catalog-products-changed', refreshProducts);
      void supabaseBrowser.removeChannel(catalogChannel);
    };
  }, []);

  const [todayDate, setTodayDate] = useState('');
  useEffect(() => {
    const refreshDate = () => setTodayDate(currentStoreDate());
    const initialUpdate = window.setTimeout(refreshDate, 0);
    const interval = window.setInterval(refreshDate, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const activeFlyers = todayDate
    ? flyers.filter((flyer) => flyer.validUntil.slice(0, 10) >= todayDate)
    : flyers;
  const selectedFlyer =
    activeFlyers.find((flyer) => String(flyer.id) === String(selectedFlyerId)) ??
    activeFlyers[0] ??
    null;

  useEffect(() => {
    let active = true;
    void supabaseBrowser
      .from(SITE_SETTINGS_TABLE)
      .select('dados')
      .eq('id', 'principal')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Não foi possível carregar as configurações públicas.', error);
          if (active) setSettingsReady(true);
          return;
        }
        if (active && data) setSettings(mergeSiteSettings(data.dados));
        if (active) setSettingsReady(true);
      });
    const refreshSettings = () => {
      void supabaseBrowser
        .from(SITE_SETTINGS_TABLE)
        .select('dados')
        .eq('id', 'principal')
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('Não foi possível atualizar as configurações públicas.', error);
            return;
          }
          if (data) setSettings(mergeSiteSettings(data.dados));
        });
    };
    const settingsChannel = supabaseBrowser
      .channel('public-site-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SITE_SETTINGS_TABLE, filter: 'id=eq.principal' },
        refreshSettings,
      )
      .subscribe();
    window.addEventListener('site-settings-changed', refreshSettings);
    return () => {
      active = false;
      window.removeEventListener('site-settings-changed', refreshSettings);
      void supabaseBrowser.removeChannel(settingsChannel);
    };
  }, []);

  useEffect(() => {
    const colorPattern = /^#[\da-f]{6}$/i;
    const primary = colorPattern.test(settings.brand.primaryColor)
      ? settings.brand.primaryColor
      : defaultSiteSettings.brand.primaryColor;
    const secondary = colorPattern.test(settings.brand.secondaryColor)
      ? settings.brand.secondaryColor
      : defaultSiteSettings.brand.secondaryColor;
    document.documentElement.style.setProperty('--brand-primary', primary);
    document.documentElement.style.setProperty('--brand-secondary', secondary);
    document.documentElement.style.colorScheme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary);
  }, [settings.brand.primaryColor, settings.brand.secondaryColor]);

  useEffect(() => {
    const storeName = settings.institution.storeName.trim();
    if (!storeName) return;
    const primaryBranch = settings.institution.branches[0];
    const city = primaryBranch?.city?.trim() || settings.institution.city.trim();
    const neighborhood =
      primaryBranch?.neighborhood?.trim() || settings.institution.neighborhood.trim();
    const location = [neighborhood, city].filter(Boolean).join(', ');
    const locationSuffix =
      pathname.startsWith('/admin') || !location ? '' : ` em ${location}`;

    if (document.title.includes(' | ')) {
      const [pageTitle] = document.title.split(' | ');
      if (pageTitle) {
        document.title = `${pageTitle} | ${storeName}${locationSuffix}`;
      }
    } else if (
      document.title === 'VerdeVale' ||
      document.title === defaultSiteSettings.institution.storeName
    ) {
      document.title = storeName;
    }
  }, [
    settings.institution.storeName,
    settings.institution.city,
    settings.institution.neighborhood,
    settings.institution.branches,
    pathname,
  ]);

  useEffect(() => {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let visitorId = window.localStorage.getItem('verdevale-visitor-id');
    if (!visitorId || !uuidPattern.test(visitorId)) {
      visitorId = window.crypto.randomUUID();
      window.localStorage.setItem('verdevale-visitor-id', visitorId);
    }
    const eventDate = currentStoreDate();
    const eventTypes =
      pathname === '/panfleto-de-ofertas' ? ['visit', 'flyer_view'] : ['visit'];
    const pendingTypes = eventTypes.filter((type) => {
      const storageKey = `verdevale-metric-${type}-${eventDate}`;
      return !window.sessionStorage.getItem(storageKey);
    });
    if (!pendingTypes.length) return;

    void Promise.all(
      pendingTypes.map(async (tipo) => {
        const { error } = await supabaseBrowser
          .from('metricas_visita')
          .insert({ tipo, visitante_id: visitorId, data_evento: eventDate });
        if (error && error.code !== '23505') {
          if (!isMissingRelationError(error)) {
            console.error(`Não foi possível registrar a métrica (${tipo}).`, error);
          }
          return;
        }
        window.sessionStorage.setItem(`verdevale-metric-${tipo}-${eventDate}`, '1');
      }),
    );
  }, [pathname]);

  return (
    <AdminDataContext.Provider
      value={{
        data: { flyer: selectedFlyer, flyers: activeFlyers },
        selectFlyer: setSelectedFlyerId,
        updateFlyers: setFlyers,
        products: liveProducts,
        settings,
        updateSettings: setSettings,
        settingsReady,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const { data, selectFlyer, updateFlyers } = useContext(AdminDataContext);
  return { data, selectFlyer, updateFlyers };
}

export function useSiteSettings() {
  const { settings, settingsReady, updateSettings } = useContext(AdminDataContext);
  return { settings, settingsReady, updateSettings };
}

export function useManagedProducts<T extends CatalogProduct>(products: T[]): T[] {
  const { products: liveProducts } = useContext(AdminDataContext);
  if (!liveProducts) return products;

  const initialById = new Map(products.map((item) => [item.id, item]));
  const sample = products[0] as
    | (T & { rating?: number; image?: string | null })
    | undefined;
  const fallbackImage =
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=85';

  return liveProducts.map((live) => {
    const existing = initialById.get(live.id);
    if (existing) {
      return {
        ...existing,
        ...live,
        image: live.image ?? existing.image,
      } as T;
    }
    return {
      ...(sample && typeof sample.rating === 'number'
        ? { rating: sample.rating }
        : {}),
      ...live,
      image:
        live.image ??
        (sample && typeof sample.image === 'string' ? fallbackImage : null),
    } as unknown as T;
  });
}

export function useManagedProduct<T extends CatalogProduct>(product: T): T {
  const { products: liveProducts } = useContext(AdminDataContext);
  if (!liveProducts) return product;
  const live = liveProducts.find((item) => item.id === product.id);
  if (!live) return product;
  return {
    ...product,
    ...live,
    image: live.image ?? product.image,
  } as T;
}
