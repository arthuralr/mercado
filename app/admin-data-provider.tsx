'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { CatalogProduct } from '@/lib/catalog-types';
import {
  defaultSiteSettings,
  mergeSiteSettings,
  currentStoreDate,
  SITE_SETTINGS_TABLE,
  type SiteSettings,
} from '@/lib/site-settings';
import { usePathname } from 'next/navigation';

export interface AdminOffer {
  id: string;
  productId: string;
  normalPrice: number;
  promoPrice: number;
  startsAt: string;
  endsAt: string;
}

export interface AdminFlyer {
  title: string;
  validUntil: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
}

interface AdminDataContextValue {
  data: { flyer: AdminFlyer | null };
  settings: SiteSettings;
  settingsReady: boolean;
  updateSettings: (settings: SiteSettings) => void;
}

const AdminDataContext = createContext<AdminDataContextValue>({
  data: { flyer: null },
  settings: defaultSiteSettings,
  settingsReady: false,
  updateSettings: () => undefined,
});

export function AdminDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flyer, setFlyer] = useState<AdminFlyer | null>(null);
  const [settings, setSettings] = useState(defaultSiteSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    void supabaseBrowser
      .from('encartes')
      .select('titulo, validade, arquivo_url, arquivo_nome')
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Não foi possível carregar o encarte publicado.', error);
          return;
        }
        if (active && data) {
          setFlyer({
            title: data.titulo,
            validUntil: data.validade,
            fileName: data.arquivo_nome,
            fileType: '',
            fileSize: 0,
            fileUrl: data.arquivo_url,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    let visitorId = window.localStorage.getItem('verdevale-visitor-id');
    if (!visitorId) {
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
    void supabaseBrowser
      .from('metricas_visita')
      .upsert(
        pendingTypes.map((tipo) => ({ tipo, visitante_id: visitorId, data_evento: eventDate })),
        { onConflict: 'tipo,visitante_id,data_evento', ignoreDuplicates: true },
      )
      .then(({ error }) => {
        if (error) {
          console.error('Não foi possível registrar a métrica de visita.', error);
          return;
        }
        for (const type of pendingTypes) {
          window.sessionStorage.setItem(`verdevale-metric-${type}-${eventDate}`, '1');
        }
      });
  }, [pathname]);

  return (
    <AdminDataContext.Provider
      value={{
        data: { flyer },
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
  return useContext(AdminDataContext);
}

export function useSiteSettings() {
  const { settings, settingsReady, updateSettings } = useContext(AdminDataContext);
  return { settings, settingsReady, updateSettings };
}

export function useManagedProducts<T extends CatalogProduct>(products: T[]) {
  return products;
}

export function useManagedProduct<T extends CatalogProduct>(product: T) {
  return product;
}
