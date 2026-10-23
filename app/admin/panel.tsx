'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BadgePercent,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChefHat,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileUp,
  Info,
  LayoutDashboard,
  LogOut,
  Inbox,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Store,
  Settings2,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { CatalogProduct } from '@/lib/catalog-types';
import {
  useAdminData,
  useSiteSettings,
  type AdminFlyer,
  type AdminOffer,
} from '../admin-data-provider';
import { revalidateCatalogAndFlyer } from '../actions/site-settings';
import { currentStoreDate } from '@/lib/site-settings';
import {
  getFlyerMimeType,
  isPdfFlyer,
  isSupportedFlyerFile,
  MAX_FLYER_FILE_SIZE,
} from '@/lib/flyer-file';
import { supabaseBrowser } from '@/lib/supabase-browser';
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchActiveOffersCount,
  fetchAdminOffers,
  fetchAdminProducts,
  fetchFlyers,
  deleteFlyer,
  fetchTodayOrderCount,
  fetchTodayMetrics,
  FLYER_SECTION_OPTIONS,
  STANDARD_PRODUCT_CATEGORIES,
  STANDARD_PRODUCT_UNITS,
  importProductPrices,
  persistFlyer,
  persistOffer,
  persistProduct,
  removeOffer as removeOfferFromDatabase,
  uploadProductImage,
  type PriceImportRow,
} from '@/lib/admin-database';
import AdminExtraPanel from './extra-panel';
import PushNotificationPanel from './push-panel';
import AdminRecipesPanel from './recipes-panel';

type Section = 'overview' | 'offers' | 'products' | 'flyer' | 'recipes' | 'settings' | 'submissions' | 'calendar' | 'push';
type OfferForm = Omit<AdminOffer, 'id'> & { id: string };

interface ProductFormState {
  id?: string;
  name: string;
  description: string;
  category: string;
  customCategory: string;
  unit: string;
  brand: string;
  normalPrice: string;
  offerPrice: string;
  stock: string;
  image: string;
  badge: string;
  flyerPage: string;
  active: boolean;
}

const defaultProductForm: ProductFormState = {
  name: '',
  description: '',
  category: 'Hortifrúti',
  customCategory: '',
  unit: 'unidade',
  brand: '',
  normalPrice: '',
  offerPrice: '',
  stock: '',
  image: '',
  badge: '',
  flyerPage: '',
  active: true,
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const sectionInfo: Record<Section, { label: string; icon: typeof LayoutDashboard }> = {
  overview: { label: 'Visão geral', icon: LayoutDashboard },
  offers: { label: 'Ofertas relâmpago', icon: BadgePercent },
  products: { label: 'Produtos e preços', icon: Package },
  flyer: { label: 'Panfleto de Ofertas', icon: FileSpreadsheet },
  recipes: { label: 'Receitas do Dia', icon: ChefHat },
  settings: { label: 'Configurações da Loja', icon: Settings2 },
  submissions: { label: 'Cadastros recebidos', icon: Inbox },
  calendar: { label: 'Calendário sazonal', icon: CalendarDays },
  push: { label: 'Disparar Notificações Push', icon: BellRing },
};

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isOfferActive(offer: AdminOffer) {
  const today = currentStoreDate();
  const startDay = String(offer.startsAt).slice(0, 10);
  const endDay = String(offer.endsAt).slice(0, 10);
  return startDay <= today && endDay >= today;
}

function offerDurationDays(offer: Pick<AdminOffer, 'startsAt' | 'endsAt'>) {
  const start = Date.parse(`${offer.startsAt}T00:00:00Z`);
  const end = Date.parse(`${offer.endsAt}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function normalizeHeaderName(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCsvPrice(raw: string | undefined): number {
  if (!raw) return Number.NaN;
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!cleaned) return Number.NaN;
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
}

function parseCsvStock(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return Number.NaN;
  }
  return parsed;
}

function parseCsv(text: string): string[][] {
  const cleanedSource = text
    .replace(/^\uFEFF/, '')
    .replace(/^\s*sep\s*=\s*[;,]\s*\r?\n/i, '');
  const firstNonEmptyLine =
    cleanedSource
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0) ?? '';
  const semicolonCount = (firstNonEmptyLine.match(/;/g) ?? []).length;
  const commaCount = (firstNonEmptyLine.match(/,/g) ?? []).length;
  const delimiter = semicolonCount >= commaCount && semicolonCount > 0 ? ';' : commaCount > 0 ? ',' : ';';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < cleanedSource.length; index += 1) {
    const character = cleanedSource[index];
    if (character === '"') {
      if (quoted && cleanedSource[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && cleanedSource[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  if (quoted) throw new Error('O CSV contém uma aspa sem fechamento.');
  return rows;
}

export default function AdminDashboard({
  products: initialProducts,
}: {
  products: CatalogProduct[];
}) {
  const router = useRouter();
  const { selectFlyer, updateFlyers } = useAdminData();
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const [products, setProducts] = useState(initialProducts);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [activeOffersTotal, setActiveOffersTotal] = useState<number | null>(null);
  const [flyers, setFlyers] = useState<AdminFlyer[]>([]);
  const [flyer, setFlyer] = useState<AdminFlyer | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [actionError, setActionError] = useState('');
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);
  const [todayFlyerViews, setTodayFlyerViews] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [search, setSearch] = useState('');
  const [offerForm, setOfferForm] = useState<OfferForm | null>(null);
  const [productDrafts, setProductDrafts] = useState<
    Record<string, { price: string; stock: string }>
  >({});
  const [productModal, setProductModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    product?: CatalogProduct;
  } | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm);
  const [productFormSaving, setProductFormSaving] = useState(false);
  const [productFormUploading, setProductFormUploading] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const productImageInput = useRef<HTMLInputElement>(null);

  const existingProductCategories = useMemo(() => {
    const categories = new Set<string>(STANDARD_PRODUCT_CATEGORIES);
    for (const product of products) {
      if (product.category?.trim()) {
        categories.add(product.category.trim());
      }
    }
    return Array.from(categories);
  }, [products]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMessage, setCsvMessage] = useState('');
  const [csvError, setCsvError] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerTitle, setFlyerTitle] = useState('');
  const [flyerValidUntil, setFlyerValidUntil] = useState('');
  const [flyerMessage, setFlyerMessage] = useState('');
  const [flyerPreview, setFlyerPreview] = useState('');
  const [flyerProductMode, setFlyerProductMode] = useState<'existing' | 'new'>('existing');
  const [flyerSelectedProductId, setFlyerSelectedProductId] = useState(
    initialProducts[0]?.id ?? '',
  );
  const [flyerProductSection, setFlyerProductSection] = useState<string>('capa');
  const [flyerProductFeatured, setFlyerProductFeatured] = useState(true);
  const [flyerProductBadge, setFlyerProductBadge] = useState('Destaque da Semana');
  const [flyerProductNormalPrice, setFlyerProductNormalPrice] = useState(
    initialProducts[0]
      ? String(initialProducts[0].oldPrice ?? initialProducts[0].price)
      : '',
  );
  const [flyerProductOfferPrice, setFlyerProductOfferPrice] = useState(
    initialProducts[0] && initialProducts[0].oldPrice !== null
      ? String(initialProducts[0].price)
      : '',
  );
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Hortifrúti');
  const [newProductUnit, setNewProductUnit] = useState('unidade');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductImage, setNewProductImage] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [flyerProductFilter, setFlyerProductFilter] = useState<string>('linked');
  const [flyerProductSearch, setFlyerProductSearch] = useState('');
  const [flyerProductStatus, setFlyerProductStatus] = useState('');
  const [flyerProductError, setFlyerProductError] = useState('');
  const [savingFlyerProduct, setSavingFlyerProduct] = useState(false);
  const [flyerProductDrafts, setFlyerProductDrafts] = useState<
    Record<
      string,
      {
        flyerPage: string;
        badge: string;
        normalPrice: string;
        offerPrice: string;
      }
    >
  >({});
  const csvInput = useRef<HTMLInputElement>(null);
  const flyerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void supabaseBrowser.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        setAuthError(`Não foi possível verificar a sessão: ${error.message}`);
        setAuthChecked(true);
        return;
      }
      if (!session) {
        setAuthChecked(true);
        return;
      }
      const { data: manager, error: managerError } = await supabaseBrowser
        .from('gestores')
        .select('usuario_id')
        .eq('usuario_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      if (managerError || !manager) {
        await supabaseBrowser.auth.signOut();
        setAuthError(
          managerError?.message ??
            'Esta conta não está autorizada como gestor. Solicite acesso ao administrador do Supabase.',
        );
      } else {
        setLoadingData(true);
        setAuthenticated(true);
      }
      setAuthChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;

    const loadAllData = () => {
      void Promise.allSettled([
        fetchAdminProducts(),
        fetchAdminOffers(),
        fetchActiveOffersCount(),
        fetchTodayOrderCount(),
        fetchTodayMetrics(),
        fetchFlyers(),
      ])
        .then(
          ([
            productsResult,
            offersResult,
            activeOffersCountResult,
            ordersResult,
            metricsResult,
            flyerResult,
          ]) => {
            if (!active) return;
            const errors: string[] = [];
            if (productsResult.status === 'fulfilled') {
              const loadedProducts = productsResult.value;
              setProducts(loadedProducts);
              const firstProduct = loadedProducts[0];
              if (firstProduct) {
                setFlyerSelectedProductId((current) => current || firstProduct.id);
              }
            } else {
              errors.push(
                productsResult.reason instanceof Error
                  ? productsResult.reason.message
                  : 'Não foi possível carregar os produtos.',
              );
            }
            if (offersResult.status === 'fulfilled') {
              setOffers(offersResult.value);
              setOffersLoaded(true);
            } else {
              errors.push(
                offersResult.reason instanceof Error
                  ? offersResult.reason.message
                  : 'Não foi possível carregar as ofertas.',
              );
            }
            if (activeOffersCountResult.status === 'fulfilled') {
              setActiveOffersTotal(activeOffersCountResult.value);
            }
            if (ordersResult.status === 'fulfilled') {
              setOrderCount(ordersResult.value);
            } else {
              errors.push(
                ordersResult.reason instanceof Error
                  ? ordersResult.reason.message
                  : 'Não foi possível carregar os pedidos de hoje.',
              );
            }
            if (metricsResult.status === 'fulfilled') {
              setTodayVisits(metricsResult.value.visits);
              setTodayFlyerViews(metricsResult.value.flyerViews);
            } else {
              errors.push(
                metricsResult.reason instanceof Error
                  ? metricsResult.reason.message
                  : 'Não foi possível carregar as métricas de visitas.',
              );
            }
            if (flyerResult.status === 'fulfilled') {
              setFlyers(flyerResult.value);
            } else {
              errors.push(
                flyerResult.reason instanceof Error
                  ? flyerResult.reason.message
                  : 'Não foi possível carregar o encarte.',
              );
            }
            setActionError(errors.join(' '));
          },
        )
        .finally(() => {
          if (active) setLoadingData(false);
        });
    };

    const refreshOverviewMetrics = () => {
      void Promise.allSettled([
        fetchTodayOrderCount(),
        fetchActiveOffersCount(),
        fetchAdminOffers(),
        fetchTodayMetrics(),
      ]).then(([ordersResult, activeOffersResult, offersResult, metricsResult]) => {
        if (!active) return;
        if (ordersResult.status === 'fulfilled') {
          setOrderCount(ordersResult.value);
        }
        if (activeOffersResult.status === 'fulfilled') {
          setActiveOffersTotal(activeOffersResult.value);
        }
        if (offersResult.status === 'fulfilled') {
          setOffers(offersResult.value);
          setOffersLoaded(true);
        }
        if (metricsResult.status === 'fulfilled') {
          setTodayVisits(metricsResult.value.visits);
          setTodayFlyerViews(metricsResult.value.flyerViews);
        }
      });
    };

    loadAllData();

    const channel = supabaseBrowser
      .channel('admin-overview-metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        refreshOverviewMetrics,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ofertas_relampago' },
        refreshOverviewMetrics,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'metricas_visita' },
        refreshOverviewMetrics,
      )
      .subscribe();

    return () => {
      active = false;
      void supabaseBrowser.removeChannel(channel);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || section !== 'overview') return;
    let active = true;
    void Promise.allSettled([
      fetchTodayOrderCount(),
      fetchActiveOffersCount(),
      fetchAdminOffers(),
      fetchTodayMetrics(),
    ]).then(([ordersResult, activeOffersResult, offersResult, metricsResult]) => {
      if (!active) return;
      if (ordersResult.status === 'fulfilled') {
        setOrderCount(ordersResult.value);
      }
      if (activeOffersResult.status === 'fulfilled') {
        setActiveOffersTotal(activeOffersResult.value);
      }
      if (offersResult.status === 'fulfilled') {
        setOffers(offersResult.value);
        setOffersLoaded(true);
      }
      if (metricsResult.status === 'fulfilled') {
        setTodayVisits(metricsResult.value.visits);
        setTodayFlyerViews(metricsResult.value.flyerViews);
      }
    });
    return () => {
      active = false;
    };
  }, [authenticated, section]);

  useEffect(
    () => () => {
      if (flyerPreview) URL.revokeObjectURL(flyerPreview);
    },
    [flyerPreview],
  );

  useEffect(() => {
    if (!flyer) return;
    const timeout = window.setTimeout(() => {
      setFlyerTitle(flyer.title);
      setFlyerValidUntil(flyer.validUntil);
      setFlyerPreview(flyer.fileUrl ?? '');
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [flyer]);

  const activeOffersCount =
    activeOffersTotal ?? offers.filter(isOfferActive).length;
  const filteredProducts = products.filter((product) =>
    `${product.id} ${product.name} ${product.brand} ${product.category}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setAuthError('');
    const { data: authData, error } = await supabaseBrowser.auth.signInWithPassword({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    });
    if (error || !authData.user) {
      setAuthError(error?.message ?? 'Não foi possível iniciar a sessão.');
      return;
    }
    const { data: manager, error: managerError } = await supabaseBrowser
      .from('gestores')
      .select('usuario_id')
      .eq('usuario_id', authData.user.id)
      .maybeSingle();
    if (managerError || !manager) {
      await supabaseBrowser.auth.signOut();
      setAuthError(
        managerError?.message ??
          'A conta autenticou, mas ainda não foi autorizada como gestor. Cadastre seu usuário em public.gestores.',
      );
      return;
    }
    setLoadingData(true);
    setAuthenticated(true);
  }

  async function logout() {
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) {
      setActionError(`Não foi possível encerrar a sessão: ${error.message}`);
      return;
    }
    setAuthenticated(false);
  }

  function beginOffer(product?: CatalogProduct, current?: AdminOffer) {
    const defaultProduct = product ?? products[0];
    setOfferForm(
      current
        ? { ...current }
        : {
            id: '',
            productId: defaultProduct?.id ?? '',
            normalPrice: defaultProduct?.oldPrice ?? defaultProduct?.price ?? 0,
            promoPrice: defaultProduct?.price ?? 0,
            startsAt: localDate(),
            endsAt: localDate(7),
          },
    );
  }

  async function submitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offerForm || offerForm.promoPrice >= offerForm.normalPrice) {
      window.alert('O preço promocional deve ser menor que o preço normal.');
      return;
    }
    if (offerForm.endsAt < offerForm.startsAt) {
      window.alert('A validade final precisa ser igual ou posterior ao início.');
      return;
    }
    const offer = {
      ...offerForm,
    };
    try {
      await persistOffer(offer);
      const [updatedOffers, updatedActiveCount] = await Promise.all([
        fetchAdminOffers(),
        fetchActiveOffersCount(),
      ]);
      setOffers(updatedOffers);
      setActiveOffersTotal(updatedActiveCount);
      setOfferForm(null);
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar a oferta.');
    }
  }

  async function removeOffer(offer: AdminOffer) {
    try {
      await removeOfferFromDatabase(offer.id);
      const nextOffers = offers.filter((item) => item.id !== offer.id);
      setOffers(nextOffers);
      setActiveOffersTotal(nextOffers.filter(isOfferActive).length);
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível remover a oferta.');
    }
  }

  async function saveProduct(product: CatalogProduct) {
    const draft = productDrafts[product.id];
    if (!draft) return;
    const price = Number(draft.price.replace(',', '.'));
    const stock = draft.stock.trim() === '' ? null : Number(draft.stock);
    if (!Number.isFinite(price) || price < 0 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
      window.alert('Informe preço e estoque válidos (valores não negativos).');
      return;
    }
    try {
      await persistProduct(product.id, { normalPrice: price, stock });
      setProductDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setProducts(await fetchAdminProducts());
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar o produto.');
    }
  }

  function openNewProductModal() {
    setProductForm(defaultProductForm);
    setProductFormError('');
    setProductModal({ isOpen: true, mode: 'create' });
  }

  function openEditProductModal(product: CatalogProduct) {
    const isStandard = (STANDARD_PRODUCT_CATEGORIES as readonly string[]).includes(
      product.category,
    );
    setProductForm({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      category: isStandard ? product.category : 'custom',
      customCategory: isStandard ? '' : product.category,
      unit: product.unit || 'unidade',
      brand: product.brand || '',
      normalPrice: String(product.oldPrice ?? product.price),
      offerPrice: product.oldPrice !== null ? String(product.price) : '',
      stock:
        product.stock === null || product.stock === undefined
          ? ''
          : String(product.stock),
      image: product.image ?? '',
      badge: product.badge ?? '',
      flyerPage: product.flyerPage ?? '',
      active: product.active ?? true,
    });
    setProductFormError('');
    setProductModal({ isOpen: true, mode: 'edit', product });
  }

  async function handleProductImageUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProductFormUploading(true);
    setProductFormError('');
    try {
      const uploadedUrl = await uploadProductImage(file);
      setProductForm((prev) => ({ ...prev, image: uploadedUrl }));
    } catch (err) {
      setProductFormError(
        err instanceof Error
          ? err.message
          : 'Falha ao fazer upload da imagem.',
      );
    } finally {
      setProductFormUploading(false);
    }
  }

  async function handleSaveProductForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductFormError('');
    setProductFormSaving(true);
    try {
      const name = productForm.name.trim();
      if (!name) throw new Error('Informe o nome do produto.');
      const normalPrice = Number(productForm.normalPrice.replace(',', '.'));
      if (!Number.isFinite(normalPrice) || normalPrice <= 0) {
        throw new Error('Informe um preço normal maior que zero.');
      }
      let offerPrice: number | null = null;
      if (productForm.offerPrice.trim()) {
        const parsedOffer = Number(productForm.offerPrice.replace(',', '.'));
        if (!Number.isFinite(parsedOffer) || parsedOffer <= 0) {
          throw new Error('O preço promocional deve ser maior que zero.');
        }
        if (parsedOffer >= normalPrice) {
          throw new Error(
            'O preço promocional deve ser menor que o preço normal.',
          );
        }
        offerPrice = Number(parsedOffer.toFixed(2));
      }
      const stock =
        productForm.stock.trim() === '' ? null : Number(productForm.stock);
      if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
        throw new Error('O estoque deve ser um número inteiro maior ou igual a zero.');
      }
      const finalCategory =
        productForm.category === 'custom'
          ? productForm.customCategory.trim() || 'Mercearia'
          : productForm.category.trim() || 'Mercearia';

      if (productModal?.mode === 'create') {
        const created = await createAdminProduct({
          name,
          description: productForm.description.trim() || null,
          category: finalCategory,
          unit: productForm.unit.trim() || 'unidade',
          brand: productForm.brand.trim() || undefined,
          normalPrice,
          offerPrice,
          stock,
          image: productForm.image.trim() || null,
          badge: productForm.badge.trim() || null,
          flyerPage: productForm.flyerPage.trim() || null,
        });
        setProducts((current) => [created, ...current]);
        setProductModal(null);
        setCsvMessage(`Produto "${created.name}" cadastrado com sucesso!`);
      } else if (productModal?.product) {
        const updated = await persistProduct(productModal.product.id, {
          name,
          description: productForm.description.trim() || null,
          category: finalCategory,
          unit: productForm.unit.trim() || 'unidade',
          brand: productForm.brand.trim() || null,
          normalPrice,
          offerPrice,
          stock,
          image: productForm.image.trim() || null,
          badge: productForm.badge.trim() || null,
          flyerPage: productForm.flyerPage.trim() || null,
          active: productForm.active,
        });
        setProducts((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setProductModal(null);
        setCsvMessage(`Produto "${updated.name}" atualizado com sucesso!`);
      }
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (err) {
      setProductFormError(
        err instanceof Error ? err.message : 'Falha ao salvar produto.',
      );
    } finally {
      setProductFormSaving(false);
    }
  }

  async function handleDeleteProduct(product: CatalogProduct) {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o produto "${product.name}"? Esta ação removerá o produto do catálogo e do encarte.`,
      )
    ) {
      return;
    }
    try {
      await deleteAdminProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (productModal?.product?.id === product.id) {
        setProductModal(null);
      }
      setCsvMessage(`Produto "${product.name}" excluído com sucesso.`);
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Não foi possível excluir o produto.',
      );
    }
  }

  function exportCurrentProductsCsv() {
    const header = 'id;preco_normal;estoque';
    const lines = products.map((product) => {
      const normalPrice = (product.oldPrice ?? product.price).toFixed(2).replace('.', ',');
      const stock = product.stock === null || product.stock === undefined ? '' : String(product.stock);
      return `${product.id};${normalPrice};${stock}`;
    });
    const csvContent = `\uFEFF${[header, ...lines].join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `produtos-precos-${localDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importPriceList() {
    if (!csvFile || importingCsv) return;
    setCsvMessage('');
    setCsvError('');
    setImportingCsv(true);
    try {
      const csvRows = parseCsv(await csvFile.text());
      if (csvRows.length < 2) {
        throw new Error('O CSV precisa conter cabeçalho e ao menos uma linha.');
      }
      const headers = csvRows[0].map(normalizeHeaderName);
      const idIndex = headers.indexOf('id');
      const priceIndex = headers.findIndex(
        (header) => header === 'preco_normal' || header === 'preco',
      );
      const stockIndex = headers.indexOf('estoque');
      if (idIndex < 0 || priceIndex < 0) {
        throw new Error(
          'Use as colunas obrigatórias "id" e "preco_normal"; "estoque" é opcional.',
        );
      }

      const ids = new Set<string>();
      const rows: PriceImportRow[] = csvRows.slice(1).map((values, index) => {
        const id = (values[idIndex] ?? '').replace(/^["']+|["']+$/g, '').trim();
        const price = parseCsvPrice(values[priceIndex]);
        const stock = stockIndex < 0 ? null : parseCsvStock(values[stockIndex]);

        if (
          !id ||
          !Number.isFinite(price) ||
          price < 0 ||
          (stock !== null && (!Number.isInteger(stock) || stock < 0))
        ) {
          throw new Error(
            `Dados inválidos na linha ${index + 2}. Confira ID, preço e estoque.`,
          );
        }
        if (ids.has(id)) {
          throw new Error(`O produto "${id}" aparece mais de uma vez no CSV.`);
        }
        ids.add(id);
        return {
          id,
          preco_normal: price,
          estoque: stock,
        };
      });

      const updatedCount = await importProductPrices(rows);

      const updatesById = new Map(rows.map((item) => [item.id, item]));
      setProductDrafts((current) => {
        const next = { ...current };
        for (const id of updatesById.keys()) {
          delete next[id];
        }
        return next;
      });

      setProducts((current) =>
        current.map((product) => {
          const imported = updatesById.get(product.id);
          if (!imported) return product;
          return {
            ...product,
            price: imported.preco_normal,
            oldPrice: null,
            stock: imported.estoque !== null ? imported.estoque : product.stock,
          };
        }),
      );

      const refreshedProducts = await fetchAdminProducts();
      setProducts(refreshedProducts);

      setCsvFile(null);
      if (csvInput.current) {
        csvInput.current.value = '';
      }
      setCsvMessage(
        `${updatedCount} produto(s) atualizado(s) com sucesso no catálogo.`,
      );
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : 'Não foi possível importar a lista.',
      );
    } finally {
      setImportingCsv(false);
    }
  }

  function saveFlyerMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flyerFile && !flyer) {
      setFlyerMessage('Escolha um arquivo de imagem ou PDF para continuar.');
      return;
    }
    if (flyerFile && !isSupportedFlyerFile(flyerFile)) {
      setFlyerMessage('Formato não suportado. Escolha um arquivo PDF, JPG, PNG ou WebP.');
      return;
    }
    if (flyerFile && flyerFile.size > MAX_FLYER_FILE_SIZE) {
      setFlyerMessage('O arquivo precisa ter no máximo 10 MB.');
      return;
    }
    if (!flyerTitle.trim() || !flyerValidUntil) {
      setFlyerMessage('Informe o título e a data de validade do encarte.');
      return;
    }
    const file = flyerFile;
    const current: AdminFlyer = {
      id: flyer?.id ?? '',
      title: flyerTitle.trim(),
      validUntil: flyerValidUntil,
      fileName: file?.name ?? flyer?.fileName ?? '',
      fileType: file ? getFlyerMimeType(file.name) : flyer?.fileType ?? '',
      fileSize: file?.size ?? flyer?.fileSize ?? 0,
      fileUrl: flyer?.fileUrl,
    };
    void persistFlyer(current, file ?? undefined)
      .then((savedFlyer) => {
        setFlyer(savedFlyer);
        const nextFlyers = [
          savedFlyer,
          ...flyers.filter((item) => item.id !== savedFlyer.id),
        ];
        setFlyers(nextFlyers);
        updateFlyers(nextFlyers);
        selectFlyer(savedFlyer.id);
        window.dispatchEvent(new Event('flyers-changed'));
        void revalidateCatalogAndFlyer().catch(() => undefined);
        setFlyerMessage('Encarte enviado e publicado no Supabase.');
        setFlyerFile(null);
        router.refresh();
      })
      .catch((error: unknown) => {
        setFlyerMessage(
          error instanceof Error ? error.message : 'Não foi possível salvar o encarte.',
        );
      });
  }

  function startNewFlyer() {
    setFlyer(null);
    setFlyerTitle('');
    setFlyerValidUntil('');
    setFlyerFile(null);
    setFlyerPreview('');
    setFlyerMessage('');
  }

  async function removeFlyer(flyerToRemove: AdminFlyer) {
    if (!window.confirm(`Excluir o encarte "${flyerToRemove.title}"?`)) return;
    try {
      await deleteFlyer(flyerToRemove.id);
      const nextFlyers = flyers.filter((item) => item.id !== flyerToRemove.id);
      setFlyers(nextFlyers);
      updateFlyers(nextFlyers);
      window.dispatchEvent(new Event('flyers-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      if (flyer?.id === flyerToRemove.id) startNewFlyer();
      setFlyerMessage('Encarte excluído.');
      router.refresh();
    } catch (error) {
      setFlyerMessage(
        error instanceof Error ? error.message : 'Não foi possível excluir o encarte.',
      );
    }
  }

  function editFlyer(flyerToEdit: AdminFlyer) {
    setFlyer(flyerToEdit);
    setFlyerTitle(flyerToEdit.title);
    setFlyerValidUntil(flyerToEdit.validUntil);
    setFlyerFile(null);
    setFlyerPreview(flyerToEdit.fileUrl ?? '');
    setFlyerMessage('');
  }

  function selectExistingProductForFlyer(productId: string) {
    setFlyerSelectedProductId(productId);
    const selected = products.find((item) => item.id === productId);
    if (!selected) return;
    setFlyerProductSection(selected.flyerPage ?? 'capa');
    const hasBadge = Boolean(selected.badge?.trim());
    setFlyerProductFeatured(hasBadge || !selected.flyerPage);
    setFlyerProductBadge(selected.badge?.trim() || 'Destaque da Semana');
    setFlyerProductNormalPrice(String(selected.oldPrice ?? selected.price));
    setFlyerProductOfferPrice(
      selected.oldPrice !== null ? String(selected.price) : '',
    );
  }

  async function submitFlyerProductForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingFlyerProduct) return;
    setFlyerProductStatus('');
    setFlyerProductError('');

    const normalPrice = parseCsvPrice(flyerProductNormalPrice);
    const hasOfferPrice = flyerProductOfferPrice.trim() !== '';
    const offerPrice = hasOfferPrice ? parseCsvPrice(flyerProductOfferPrice) : null;
    const sectionValue = flyerProductSection.trim() || null;
    const badgeValue = flyerProductFeatured
      ? flyerProductBadge.trim() || 'Destaque da Semana'
      : null;

    if (!sectionValue && !badgeValue && offerPrice === null) {
      setFlyerProductError(
        'Escolha uma seção do panfleto, marque o item como destaque ou informe um preço promocional.',
      );
      return;
    }
    if (!Number.isFinite(normalPrice) || normalPrice <= 0) {
      setFlyerProductError('Informe um preço normal válido maior que zero.');
      return;
    }
    if (
      offerPrice !== null &&
      (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice >= normalPrice)
    ) {
      setFlyerProductError(
        'O preço promocional no encarte deve ser maior que zero e menor que o preço normal.',
      );
      return;
    }

    setSavingFlyerProduct(true);
    try {
      if (flyerProductMode === 'new') {
        const cleanName = newProductName.trim();
        if (!cleanName) {
          throw new Error('Informe o nome do novo produto para adicioná-lo ao panfleto.');
        }
        const parsedStock = parseCsvStock(newProductStock);
        if (parsedStock !== null && Number.isNaN(parsedStock)) {
          throw new Error('O estoque do novo produto deve ser um número inteiro válido.');
        }
        const created = await createAdminProduct({
          name: cleanName,
          category: newProductCategory.trim() || 'Hortifrúti',
          unit: newProductUnit.trim() || 'unidade',
          brand: newProductBrand.trim() || 'Seleção da Loja',
          normalPrice,
          offerPrice,
          stock: parsedStock,
          flyerPage: sectionValue ?? 'capa',
          badge: badgeValue,
          image: newProductImage.trim() || null,
        });
        const refreshed = await fetchAdminProducts();
        setProducts(refreshed);
        setFlyerSelectedProductId(created.id);
        setFlyerProductMode('existing');
        setNewProductName('');
        setNewProductBrand('');
        setNewProductImage('');
        setNewProductStock('');
        setFlyerProductStatus(
          `Produto "${created.name}" cadastrado e adicionado ao panfleto de ofertas com sucesso!`,
        );
      } else {
        if (!flyerSelectedProductId) {
          throw new Error('Selecione um produto do catálogo.');
        }
        const updated = await persistProduct(flyerSelectedProductId, {
          flyerPage: sectionValue,
          badge: badgeValue,
          normalPrice,
          offerPrice,
          active: true,
        });
        setProducts((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setFlyerProductDrafts((current) => {
          const next = { ...current };
          delete next[updated.id];
          return next;
        });
        setFlyerProductStatus(
          `Produto "${updated.name}" atualizado no panfleto de ofertas e refletido na loja!`,
        );
      }
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setFlyerProductError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o produto no panfleto.',
      );
    } finally {
      setSavingFlyerProduct(false);
    }
  }

  function updateFlyerProductDraft(
    product: CatalogProduct,
    patch: Partial<{
      flyerPage: string;
      badge: string;
      normalPrice: string;
      offerPrice: string;
    }>,
  ) {
    setFlyerProductDrafts((current) => {
      const existing = current[product.id] ?? {
        flyerPage: product.flyerPage ?? '',
        badge: product.badge ?? '',
        normalPrice: String(product.oldPrice ?? product.price),
        offerPrice: product.oldPrice !== null ? String(product.price) : '',
      };
      return {
        ...current,
        [product.id]: {
          ...existing,
          ...patch,
        },
      };
    });
  }

  async function saveFlyerProductRow(product: CatalogProduct) {
    const draft = flyerProductDrafts[product.id];
    const flyerPage = (draft ? draft.flyerPage : product.flyerPage ?? '').trim() || null;
    const badge = (draft ? draft.badge : product.badge ?? '').trim() || null;
    const normalPriceRaw = draft
      ? draft.normalPrice
      : String(product.oldPrice ?? product.price);
    const offerPriceRaw = draft
      ? draft.offerPrice
      : product.oldPrice !== null
        ? String(product.price)
        : '';

    const normalPrice = parseCsvPrice(normalPriceRaw);
    const offerPrice = offerPriceRaw.trim() === '' ? null : parseCsvPrice(offerPriceRaw);

    setFlyerProductStatus('');
    setFlyerProductError('');

    if (!Number.isFinite(normalPrice) || normalPrice <= 0) {
      setFlyerProductError(`Informe um preço normal válido para "${product.name}".`);
      return;
    }
    if (
      offerPrice !== null &&
      (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice >= normalPrice)
    ) {
      setFlyerProductError(
        `O preço promocional de "${product.name}" deve ser menor que o preço normal.`,
      );
      return;
    }

    try {
      const updated = await persistProduct(product.id, {
        flyerPage,
        badge,
        normalPrice,
        offerPrice,
      });
      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setFlyerProductDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setFlyerProductStatus(
        `Alterações de "${updated.name}" gravadas no panfleto com sucesso.`,
      );
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setFlyerProductError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o produto no panfleto.',
      );
    }
  }

  async function toggleProductHighlightQuick(product: CatalogProduct) {
    setFlyerProductStatus('');
    setFlyerProductError('');
    const isCurrentlyHighlighted = Boolean(product.badge?.trim());
    const nextBadge = isCurrentlyHighlighted ? null : 'Destaque da Semana';
    const nextFlyerPage =
      !isCurrentlyHighlighted && !product.flyerPage ? 'capa' : product.flyerPage;
    try {
      const updated = await persistProduct(product.id, {
        badge: nextBadge,
        flyerPage: nextFlyerPage,
      });
      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setFlyerProductDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setFlyerProductStatus(
        nextBadge
          ? `"${updated.name}" marcado como destaque no encarte!`
          : `Destaque removido de "${updated.name}".`,
      );
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setFlyerProductError(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar o destaque do produto.',
      );
    }
  }

  async function removeProductFromFlyer(product: CatalogProduct) {
    setFlyerProductStatus('');
    setFlyerProductError('');
    try {
      const updated = await persistProduct(product.id, {
        flyerPage: null,
        badge: null,
        offerPrice: null,
      });
      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setFlyerProductDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setFlyerProductStatus(`"${updated.name}" foi removido do panfleto de ofertas.`);
      window.dispatchEvent(new Event('catalog-products-changed'));
      void revalidateCatalogAndFlyer().catch(() => undefined);
      router.refresh();
    } catch (error) {
      setFlyerProductError(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o produto do panfleto.',
      );
    }
  }

  if (!authChecked) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-600">
        Carregando painel...
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f6f2] px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline">
            <ArrowLeft size={16} /> Voltar à loja
          </Link>
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-800 text-white">
            <Store size={24} />
          </span>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Área administrativa · {storeName}</p>
          <h1 className="mb-2 mt-0 text-3xl font-black text-slate-900">Painel do gestor</h1>
          <p className="mb-7 text-sm leading-6 text-slate-500">
            Entre para gerenciar produtos, ofertas e o encarte digital.
          </p>
          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              E-mail
              <input name="email" type="email" required autoComplete="username" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Senha
              <input name="password" type="password" required autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" />
            </label>
            <button type="submit" className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white hover:bg-emerald-700">
              Entrar no painel
            </button>
          </form>
          {authError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{authError}</p>}
        </section>
      </main>
    );
  }

  const activeSection = sectionInfo[section];
  const SectionIcon = activeSection.icon;

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {settings.brand.logoUrl ? (
              <Image
                src={settings.brand.logoUrl}
                alt={storeName}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-xl border border-slate-200 object-contain p-1"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800 text-white"><Store size={21} /></span>
            )}
            <span>
              <strong className="block leading-5 text-emerald-950">{storeName}</strong>
              <span className="text-xs text-slate-500">Painel do gestor</span>
            </span>
            <span className="hidden rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800 sm:inline-flex">Supabase conectado</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex"><Store size={16} /> Ver loja</Link>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut size={16} /> <span className="hidden sm:inline">Sair</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <nav aria-label="Menu administrativo" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {(Object.entries(sectionInfo) as [Section, (typeof sectionInfo)[Section]][]).map(([key, item]) => {
              const Icon = item.icon;
              return (
                <button key={key} type="button" onClick={() => setSection(key)} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${section === key ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-emerald-800'}`}>
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700"><SectionIcon size={15} /> Gestão da loja</p>
              <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{activeSection.label}</h1>
            </div>
            <p className="m-0 text-xs text-slate-500">Dados sincronizados com o PostgreSQL do Supabase.</p>
          </div>
          {actionError && <p role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} aria-label="Fechar aviso" className="rounded p-1 hover:bg-rose-100"><X size={16} /></button></p>}
          {loadingData && <p role="status" className="mb-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Sincronizando dados do Supabase...</p>}

          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={CircleDollarSign} label="Pedidos hoje" value={orderCount === null ? '—' : String(orderCount)} trend="Consulta em pedidos" color="emerald" />
                <Metric icon={BadgePercent} label="Ofertas ativas" value={offersLoaded || activeOffersTotal !== null ? String(activeOffersCount) : '—'} trend="Consulta em ofertas_relampago" color="orange" />
                <Metric icon={Eye} label="Visualizações do encarte hoje" value={todayFlyerViews === null ? '—' : String(todayFlyerViews)} trend="Visitantes únicos/dia" color="blue" />
                <Metric icon={Users} label="Visitas ao site hoje" value={todayVisits === null ? '—' : String(todayVisits)} trend="Visitantes únicos/dia" color="purple" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div><h2 className="m-0 text-lg font-black">Atalhos de gestão</h2><p className="mb-0 mt-1 text-sm text-slate-500">Acesse as tarefas mais comuns.</p></div>
                  <Activity className="text-emerald-700" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <QuickAction icon={BadgePercent} label="Criar uma oferta" onClick={() => { beginOffer(); setSection('offers'); }} />
                  <QuickAction icon={Package} label="Editar produtos" onClick={() => setSection('products')} />
                  <QuickAction icon={FileUp} label="Atualizar encarte" onClick={() => setSection('flyer')} />
                  <QuickAction icon={ChefHat} label="Receitas do Dia" onClick={() => setSection('recipes')} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="m-0 text-lg font-black">Ofertas em destaque</h2><p className="mb-0 mt-1 text-sm text-slate-500">Promoções programadas para o catálogo.</p></div><button type="button" onClick={() => setSection('offers')} className="text-sm font-bold text-emerald-800 hover:underline">Gerenciar</button></div>
                <div className="divide-y divide-slate-100">
                  {offers.filter(isOfferActive).slice(0, 4).map((offer) => {
                    const product = products.find((item) => item.id === offer.productId);
                    if (!product) return null;
                    return <div key={offer.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate text-sm font-semibold">{product.name}</span><span className="shrink-0 text-sm font-black text-emerald-800">{currency.format(offer.promoPrice)}</span></div>;
                  })}
                  {offersLoaded && !activeOffersCount && <p className="py-4 text-sm text-slate-500">Nenhuma oferta ativa no momento.</p>}
                </div>
              </div>
            </div>
          )}

          {(section === 'settings' || section === 'submissions' || section === 'calendar') && (
            <AdminExtraPanel section={section} />
          )}

          {section === 'recipes' && <AdminRecipesPanel />}

          {section === 'offers' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="m-0 text-sm text-emerald-950"><strong>{offersLoaded ? activeOffersCount : '—'}</strong> oferta(s) com validade vigente.</p>
                <button type="button" onClick={() => beginOffer()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Plus size={17} /> Nova oferta</button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="hidden grid-cols-[minmax(200px,1.6fr)_1fr_1fr_1.5fr_100px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>Produto</span><span>Preço normal</span><span>Oferta</span><span>Período</span><span>Ações</span></div>
                {offers.map((offer) => {
                  const product = products.find((item) => item.id === offer.productId);
                  if (!product) return null;
                  return <div key={offer.id} className="grid gap-2 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[minmax(200px,1.6fr)_1fr_1fr_1.5fr_100px] md:items-center md:gap-3 md:px-5">
                    <div className="min-w-0"><span className="block truncate text-sm font-bold">{product.name}</span><span className="text-xs text-slate-500">{product.category}</span></div>
                    <span className="text-sm text-slate-500 md:text-slate-700"><span className="md:hidden">Normal: </span>{currency.format(offer.normalPrice)}</span>
                    <span className="text-sm font-black text-emerald-800"><span className="font-normal text-slate-500 md:hidden">Oferta: </span>{currency.format(offer.promoPrice)}</span>
                    <span className="text-xs text-slate-500">{new Date(`${offer.startsAt}T12:00:00`).toLocaleDateString('pt-BR')} – {new Date(`${offer.endsAt}T12:00:00`).toLocaleDateString('pt-BR')} <span className={`ml-1 rounded-full px-2 py-0.5 font-bold ${isOfferActive(offer) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{isOfferActive(offer) ? 'Ativa' : 'Agendada/encerrada'}</span></span>
                    <div className="flex gap-1">
                      <button type="button" aria-label={`Editar oferta ${product.name}`} onClick={() => beginOffer(product, offer)} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"><Pencil size={16} /></button>
                      <button type="button" aria-label={`Remover oferta ${product.name}`} onClick={() => removeOffer(offer)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></button>
                    </div>
                  </div>;
                })}
                {offersLoaded && !offers.length && <p className="p-8 text-center text-sm text-slate-500">Nenhuma oferta cadastrada. Crie a primeira promoção.</p>}
              </div>
            </div>
          )}

          {section === 'push' && <PushNotificationPanel />}

          {section === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"><Search size={18} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ID, produto, marca ou categoria" className="w-full bg-transparent text-sm outline-none" aria-label="Buscar produtos no painel" /></label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
                  >
                    <Plus size={18} />
                    Novo Produto
                  </button>
                  <button type="button" onClick={exportCurrentProductsCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Download size={17} /> Baixar CSV atual</button>
                  <button type="button" onClick={() => csvInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"><FileSpreadsheet size={17} /> Importar lista CSV</button>
                </div>
                <input ref={csvInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ''; setCsvFile(file); setCsvMessage(''); setCsvError(''); }} />
              </div>
              <aside aria-label="Ajuda para importar arquivo CSV" className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Info size={19} className="mt-0.5 shrink-0 text-blue-700" />
                  <div className="min-w-0 space-y-2">
                    <h3 className="m-0 text-sm font-black text-slate-900">Como preparar sua lista CSV</h3>
                    <p className="m-0 text-sm text-slate-700">
                      Colunas obrigatórias: <code className="rounded bg-white px-1.5 py-0.5 font-bold">id</code> e <code className="rounded bg-white px-1.5 py-0.5 font-bold">preco_normal</code>. A coluna <code className="rounded bg-white px-1.5 py-0.5 font-bold">estoque</code> é opcional.
                    </p>
                    <p className="m-0 text-sm font-semibold text-amber-900">
                      A importação atualiza produtos que já existem, localizados pelo ID. Para criar novos itens, utilize o botão <strong>&ldquo;Novo Produto&rdquo;</strong> acima.
                    </p>
                    <div className="rounded-xl border border-blue-100 bg-white px-3 py-2.5">
                      <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-wide text-slate-500">Exemplo (separador ; e decimal com vírgula)</p>
                      <code className="block overflow-x-auto whitespace-pre text-xs leading-5 text-slate-800">id;preco_normal;estoque<br />produto-123;12,50;30</code>
                    </div>
                  </div>
                </div>
              </aside>
              {csvFile && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                  <span>
                    <strong>{csvFile.name}</strong> selecionado · cabeçalhos <code>id;preco_normal;estoque</code>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={importingCsv}
                      onClick={() => void importPriceList()}
                      className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {importingCsv ? 'Importando...' : 'Importar preços'}
                    </button>
                    <button
                      type="button"
                      disabled={importingCsv}
                      onClick={() => {
                        setCsvFile(null);
                        setCsvMessage('');
                        setCsvError('');
                      }}
                      aria-label="Cancelar seleção de CSV"
                      className="rounded-lg p-2 text-slate-600 hover:bg-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
              {csvError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
                  {csvError}
                </p>
              )}
              {csvMessage && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  {csvMessage}
                </p>
              )}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Produto</th>
                      <th className="px-4 py-3 font-bold">Categoria / Setor</th>
                      <th className="px-4 py-3 font-bold">Preço (R$)</th>
                      <th className="px-4 py-3 font-bold">Estoque</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => {
                      const active = product.active ?? true;
                      const draft = productDrafts[product.id];
                      return (
                        <tr key={product.id} className="align-middle transition hover:bg-slate-50/60">
                          <td className="max-w-80 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                {product.image ? (
                                  <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="48px"
                                    className="object-contain p-1"
                                    unoptimized
                                  />
                                ) : (
                                  <Package size={20} className="text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-slate-900">{product.name}</span>
                                <span className="block truncate text-xs text-slate-500">
                                  {product.brand ? `${product.brand} · ` : ''}{product.unit} · <code className="text-[11px] text-slate-400">{product.id}</code>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                            <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label={`Preço de ${product.name}`}
                              value={draft?.price ?? String(product.oldPrice ?? product.price)}
                              onChange={(event) =>
                                setProductDrafts((current) => ({
                                  ...current,
                                  [product.id]: {
                                    price: event.target.value,
                                    stock: current[product.id]?.stock ?? String(product.stock ?? ''),
                                  },
                                }))
                              }
                              className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-emerald-700"
                            />
                            {product.oldPrice !== null && (
                              <span className="mt-0.5 block text-[11px] font-bold text-red-600">
                                Oferta: {currency.format(product.price)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              aria-label={`Estoque de ${product.name}`}
                              value={draft?.stock ?? String(product.stock ?? '')}
                              onChange={(event) =>
                                setProductDrafts((current) => ({
                                  ...current,
                                  [product.id]: {
                                    price: current[product.id]?.price ?? String(product.oldPrice ?? product.price),
                                    stock: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Ilimitado"
                              className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-emerald-700"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                void persistProduct(product.id, { active: !active })
                                  .then(() => {
                                    setProducts((current) =>
                                      current.map((item) =>
                                        item.id === product.id ? { ...item, active: !active } : item,
                                      ),
                                    );
                                    router.refresh();
                                  })
                                  .catch((error: unknown) =>
                                    setActionError(
                                      error instanceof Error
                                        ? error.message
                                        : 'Não foi possível alterar o status do produto.',
                                    ),
                                  )
                              }
                              aria-pressed={active}
                              className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                                active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {active ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {draft && (
                                <button
                                  type="button"
                                  onClick={() => saveProduct(product)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                                >
                                  Salvar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditProductModal(product)}
                                title="Editar produto completo (imagem, setor, valores, etc.)"
                                aria-label={`Editar ${product.name}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <Pencil size={13} />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteProduct(product)}
                                title="Excluir produto"
                                aria-label={`Excluir ${product.name}`}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredProducts.length && (
                  <p className="p-8 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>
                )}
              </div>
              <p className="text-xs leading-5 text-slate-500">A importação atualiza preços e, se informada, a quantidade em estoque dos produtos selecionados. Se qualquer ID ou valor for inválido, o arquivo inteiro é rejeitado.</p>
            </div>
          )}

          {section === 'flyer' && (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="m-0 text-lg font-black">Encartes cadastrados</h2>
                  <p className="mb-0 mt-1 text-sm text-slate-500">Edite os dados ou exclua encartes antigos.</p>
                </div>
                {flyers.length ? (
                  <ul className="m-0 divide-y divide-slate-100 p-0">
                    {flyers.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-slate-900">{item.title}</strong>
                          <span className="block truncate text-xs text-slate-500">{item.fileName}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Válido até {new Date(`${item.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}
                            {item.validUntil < currentStoreDate() && <span className="ml-2 font-bold text-rose-700">Expirado</span>}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editFlyer(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            <Pencil size={14} />Editar
                          </button>
                          <button type="button" onClick={() => void removeFlyer(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                            <Trash2 size={14} />Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 px-5 py-6 text-sm text-slate-500">Nenhum encarte cadastrado.</p>
                )}
              </section>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <form onSubmit={saveFlyerMetadata} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-lg font-black">{flyer ? 'Editar encarte' : 'Novo encarte'}</h2><p className="mb-0 mt-1 text-sm text-slate-500">Cadastre a arte e informe até quando ela é válida.</p></div><button type="button" onClick={startNewFlyer} className="shrink-0 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">Novo encarte</button></div>
                <label className="block text-sm font-semibold">Título do encarte<input required value={flyerTitle} onChange={(event) => setFlyerTitle(event.target.value)} placeholder="Ex.: Ofertas da semana" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" /></label>
                <label className="block text-sm font-semibold">Válido até<input required type="date" value={flyerValidUntil} onChange={(event) => setFlyerValidUntil(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" /></label>
                <input ref={flyerInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ''; setFlyerMessage(''); if (file && !isSupportedFlyerFile(file)) { setFlyerMessage('Formato não suportado. Escolha um arquivo PDF, JPG, PNG ou WebP.'); return; } if (file && file.size > MAX_FLYER_FILE_SIZE) { setFlyerMessage('O arquivo precisa ter no máximo 10 MB.'); return; } if (flyerPreview) URL.revokeObjectURL(flyerPreview); setFlyerFile(file); setFlyerPreview(file ? URL.createObjectURL(file) : ''); }} />
                <button type="button" onClick={() => flyerInput.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center hover:bg-emerald-50"><Upload size={24} className="text-emerald-800" /><span className="font-bold text-emerald-950">{flyerFile?.name ?? flyer?.fileName ?? 'Selecionar imagem ou PDF'}</span><span className="text-xs text-slate-500">JPG, PNG, WebP ou PDF · até 10 MB</span></button>
                {flyerMessage && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{flyerMessage}</p>}
                <button type="submit" className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white hover:bg-emerald-700"><Check size={17} className="mr-2 inline" />Salvar informações do encarte</button>
                <p className="m-0 text-xs leading-5 text-slate-500">O arquivo e os metadados são publicados no Supabase Storage e PostgreSQL para todas as pessoas que acessarem a loja.</p>
              </form>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="mb-4 mt-0 text-lg font-black">Pré-visualização</h2>
                {flyerPreview && isPdfFlyer(flyerFile?.name ?? flyer?.fileName ?? '', flyerFile?.type ?? flyer?.fileType) ? <iframe src={flyerPreview} title="Prévia do PDF do encarte" className="h-[520px] w-full rounded-xl border border-slate-200" /> : flyerPreview && (flyerFile ? isSupportedFlyerFile(flyerFile) : Boolean(flyer?.fileType.startsWith('image/'))) ? <Image src={flyerPreview} alt="Prévia do encarte selecionado" width={800} height={1000} unoptimized className="max-h-[520px] w-full rounded-xl object-contain" /> : flyer ? <div className="rounded-xl bg-slate-50 p-5"><p className="mb-1 mt-0 font-bold">{flyer.title}</p><p className="mb-0 mt-0 text-sm text-slate-500">{flyer.fileName}</p><p className="mb-0 mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Válido até {new Date(`${flyer.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</p></div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400"><div><FileUp size={30} className="mx-auto mb-2" />Selecione uma arte para pré-visualizar</div></div>}
              </section>
              </div>

              <section
                aria-labelledby="flyer-products-management-title"
                className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="mb-1 mt-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                      <Sparkles size={14} />
                      Vitrine e destaques do encarte
                    </p>
                    <h2
                      id="flyer-products-management-title"
                      className="m-0 text-lg font-black text-slate-900 sm:text-xl"
                    >
                      Produtos do Panfleto e Itens em Destaque
                    </h2>
                    <p className="mb-0 mt-1 text-sm text-slate-500">
                      Adicione produtos às seções do panfleto ou selecione itens para destaque. As alterações são salvas no Supabase e exibidas imediatamente na página pública do encarte.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
                      {
                        products.filter(
                          (item) =>
                            Boolean(item.flyerPage?.trim()) ||
                            Boolean(item.badge?.trim()) ||
                            item.oldPrice !== null,
                        ).length
                      }{' '}
                      no encarte
                    </span>
                    <span className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
                      {products.filter((item) => Boolean(item.badge?.trim())).length}{' '}
                      em destaque
                    </span>
                    <Link
                      href="/panfleto-de-ofertas"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                    >
                      <Eye size={14} />
                      Ver encarte público
                    </Link>
                  </div>
                </div>

                <form
                  onSubmit={(event) => void submitFlyerProductForm(event)}
                  className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-base font-black text-slate-900">
                        Adicionar produto ao panfleto ou selecionar para destaque
                      </h3>
                      <p className="mb-0 mt-0.5 text-xs text-slate-600">
                        Vincule um produto existente do catálogo ou cadastre um novo item diretamente no encarte.
                      </p>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setFlyerProductMode('existing')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          flyerProductMode === 'existing'
                            ? 'bg-emerald-800 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Selecionar do catálogo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFlyerProductMode('new');
                          setFlyerProductSection('capa');
                          setFlyerProductFeatured(true);
                          setFlyerProductBadge('Destaque da Semana');
                          setFlyerProductNormalPrice('');
                          setFlyerProductOfferPrice('');
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          flyerProductMode === 'new'
                            ? 'bg-emerald-800 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        + Novo produto no encarte
                      </button>
                    </div>
                  </div>

                  {flyerProductMode === 'existing' ? (
                    <label className="block text-sm font-semibold text-slate-700">
                      Produto do catálogo
                      <select
                        required
                        value={flyerSelectedProductId}
                        onChange={(event) =>
                          selectExistingProductForFlyer(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.category} ·{' '}
                            {currency.format(product.oldPrice ?? product.price)})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                        Nome do produto
                        <input
                          required
                          value={newProductName}
                          onChange={(event) => setNewProductName(event.target.value)}
                          placeholder="Ex.: Filé de Peito de Frango Resfriado 1kg"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Categoria
                        <select
                          value={newProductCategory}
                          onChange={(event) =>
                            setNewProductCategory(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        >
                          <option value="Hortifrúti">Hortifrúti</option>
                          <option value="Açougue">Açougue</option>
                          <option value="Padaria">Padaria</option>
                          <option value="Bebidas">Bebidas</option>
                          <option value="Mercearia">Mercearia</option>
                          <option value="Limpeza">Limpeza</option>
                          <option value="Laticínios">Laticínios</option>
                        </select>
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Unidade
                        <input
                          value={newProductUnit}
                          onChange={(event) => setNewProductUnit(event.target.value)}
                          placeholder="Ex.: kg, bandeja 500g, un"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Marca
                        <input
                          value={newProductBrand}
                          onChange={(event) => setNewProductBrand(event.target.value)}
                          placeholder="Ex.: Seara, Seleção da Loja"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Estoque inicial (opcional)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newProductStock}
                          onChange={(event) => setNewProductStock(event.target.value)}
                          placeholder="Ex.: 50"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
                        URL da imagem do produto (opcional)
                        <input
                          type="url"
                          value={newProductImage}
                          onChange={(event) => setNewProductImage(event.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Seção no panfleto
                      <select
                        value={flyerProductSection}
                        onChange={(event) =>
                          setFlyerProductSection(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                      >
                        {FLYER_SECTION_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                        <option value="">Sem seção fixa (apenas lateral)</option>
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Preço normal (R$)
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={flyerProductNormalPrice}
                        onChange={(event) =>
                          setFlyerProductNormalPrice(event.target.value)
                        }
                        placeholder="Ex.: 24.90"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Preço promocional no encarte (opcional)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={flyerProductOfferPrice}
                        onChange={(event) =>
                          setFlyerProductOfferPrice(event.target.value)
                        }
                        placeholder="Ex.: 18.90"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                      />
                    </label>

                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={flyerProductFeatured}
                          onChange={(event) =>
                            setFlyerProductFeatured(event.target.checked)
                          }
                          className="h-4 w-4 accent-emerald-700"
                        />
                        Destacar item (selo)
                      </label>
                      <input
                        disabled={!flyerProductFeatured}
                        value={flyerProductBadge}
                        onChange={(event) =>
                          setFlyerProductBadge(event.target.value)
                        }
                        placeholder="Ex.: Destaque da Semana"
                        maxLength={60}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-semibold">Selos rápidos:</span>
                      {[
                        'Destaque da Semana',
                        'Oferta do Encarte',
                        'Direto da Roça',
                        'Corte Nobre',
                        'Tamanho Família',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setFlyerProductFeatured(true);
                            setFlyerProductBadge(suggestion);
                          }}
                          className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={savingFlyerProduct}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Plus size={17} />
                      {savingFlyerProduct
                        ? 'Salvando no encarte...'
                        : flyerProductMode === 'new'
                          ? 'Cadastrar e adicionar ao panfleto'
                          : 'Salvar produto no panfleto'}
                    </button>
                  </div>
                </form>

                {flyerProductError && (
                  <p
                    role="alert"
                    className="m-0 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800"
                  >
                    {flyerProductError}
                  </p>
                )}
                {flyerProductStatus && (
                  <p
                    role="status"
                    className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"
                  >
                    {flyerProductStatus}
                  </p>
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'linked', label: 'No panfleto / Em destaque' },
                        { id: 'all', label: 'Todos do catálogo' },
                        ...FLYER_SECTION_OPTIONS.map((opt) => ({
                          id: opt.id,
                          label: opt.label,
                        })),
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFlyerProductFilter(tab.id)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                            flyerProductFilter === tab.id
                              ? 'bg-emerald-800 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:max-w-xs">
                      <Search size={16} className="text-slate-400" />
                      <input
                        value={flyerProductSearch}
                        onChange={(event) =>
                          setFlyerProductSearch(event.target.value)
                        }
                        placeholder="Filtrar produtos..."
                        aria-label="Filtrar produtos do panfleto"
                        className="w-full bg-transparent text-xs outline-none"
                      />
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[920px] border-collapse text-left">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-bold">Produto</th>
                          <th className="px-4 py-3 font-bold">Seção no Panfleto</th>
                          <th className="px-4 py-3 font-bold">Selo de Destaque</th>
                          <th className="px-4 py-3 font-bold">Preço Normal (R$)</th>
                          <th className="px-4 py-3 font-bold">Preço Encarte (R$)</th>
                          <th className="px-4 py-3 font-bold">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products
                          .filter((product) => {
                            const matchesQuery =
                              !flyerProductSearch.trim() ||
                              `${product.id} ${product.name} ${product.brand} ${product.category} ${product.badge ?? ''}`
                                .toLocaleLowerCase('pt-BR')
                                .includes(
                                  flyerProductSearch
                                    .trim()
                                    .toLocaleLowerCase('pt-BR'),
                                );
                            if (!matchesQuery) return false;
                            if (flyerProductFilter === 'all') return true;
                            if (flyerProductFilter === 'linked') {
                              return (
                                Boolean(product.flyerPage?.trim()) ||
                                Boolean(product.badge?.trim()) ||
                                product.oldPrice !== null
                              );
                            }
                            return product.flyerPage === flyerProductFilter;
                          })
                          .map((product) => {
                            const draft = flyerProductDrafts[product.id];
                            const currentFlyerPage =
                              draft?.flyerPage ?? product.flyerPage ?? '';
                            const currentBadge =
                              draft?.badge ?? product.badge ?? '';
                            const currentNormalPrice =
                              draft?.normalPrice ??
                              String(product.oldPrice ?? product.price);
                            const currentOfferPrice =
                              draft?.offerPrice ??
                              (product.oldPrice !== null
                                ? String(product.price)
                                : '');
                            const isLinked =
                              Boolean(product.flyerPage?.trim()) ||
                              Boolean(product.badge?.trim()) ||
                              product.oldPrice !== null;
                            const isHighlighted = Boolean(product.badge?.trim());

                            return (
                              <tr key={product.id} className="align-middle">
                                <td className="max-w-64 px-4 py-3">
                                  <span className="block truncate text-sm font-bold text-slate-900">
                                    {product.name}
                                  </span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span>{product.category}</span>
                                    <span>·</span>
                                    <code className="text-[11px] text-slate-400">
                                      {product.id}
                                    </code>
                                    {isHighlighted && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                                        <Tag size={10} />
                                        {product.badge}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    aria-label={`Seção no panfleto de ${product.name}`}
                                    value={currentFlyerPage}
                                    onChange={(event) =>
                                      updateFlyerProductDraft(product, {
                                        flyerPage: event.target.value,
                                      })
                                    }
                                    className="w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                                  >
                                    <option value="">Fora do panfleto</option>
                                    {FLYER_SECTION_OPTIONS.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void toggleProductHighlightQuick(product)
                                      }
                                      title={
                                        isHighlighted
                                          ? 'Remover destaque rápido'
                                          : 'Destacar rapidamente no encarte'
                                      }
                                      aria-label={
                                        isHighlighted
                                          ? `Remover destaque de ${product.name}`
                                          : `Destacar ${product.name} no encarte`
                                      }
                                      className={`rounded-lg border p-1.5 transition ${
                                        isHighlighted
                                          ? 'border-orange-300 bg-orange-50 text-orange-600'
                                          : 'border-slate-200 bg-white text-slate-400 hover:text-orange-500'
                                      }`}
                                    >
                                      <Star
                                        size={15}
                                        fill={isHighlighted ? 'currentColor' : 'none'}
                                      />
                                    </button>
                                    <input
                                      aria-label={`Selo de destaque de ${product.name}`}
                                      value={currentBadge}
                                      onChange={(event) =>
                                        updateFlyerProductDraft(product, {
                                          badge: event.target.value,
                                        })
                                      }
                                      placeholder="Sem selo"
                                      maxLength={60}
                                      className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    aria-label={`Preço normal de ${product.name}`}
                                    value={currentNormalPrice}
                                    onChange={(event) =>
                                      updateFlyerProductDraft(product, {
                                        normalPrice: event.target.value,
                                      })
                                    }
                                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    aria-label={`Preço promocional no encarte de ${product.name}`}
                                    value={currentOfferPrice}
                                    onChange={(event) =>
                                      updateFlyerProductDraft(product, {
                                        offerPrice: event.target.value,
                                      })
                                    }
                                    placeholder="—"
                                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void saveFlyerProductRow(product)
                                      }
                                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                                    >
                                      Salvar
                                    </button>
                                    {isLinked && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void removeProductFromFlyer(product)
                                        }
                                        aria-label={`Remover ${product.name} do encarte`}
                                        className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                                      >
                                        Remover
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>

      <footer className="mx-auto w-full max-w-[1500px] px-4 pb-6 text-center text-xs text-slate-400 sm:px-6 lg:px-8">{storeName} · Painel administrativo</footer>

      {offerForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOfferForm(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="offer-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between"><div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">Promoção</p><h2 id="offer-dialog-title" className="m-0 text-xl font-black">{offerForm.id ? 'Editar oferta' : 'Nova oferta relâmpago'}</h2></div><button type="button" onClick={() => setOfferForm(null)} aria-label="Fechar formulário de oferta" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            <form onSubmit={submitOffer} className="space-y-4">
              <label className="block text-sm font-semibold">Produto<select required value={offerForm.productId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setOfferForm((current) => current ? { ...current, productId: event.target.value, normalPrice: product?.oldPrice ?? product?.price ?? current.normalPrice, promoPrice: product?.price ?? current.promoPrice } : current); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Preço normal<input required type="number" min="0.01" step="0.01" value={offerForm.normalPrice} onChange={(event) => setOfferForm((current) => current ? { ...current, normalPrice: Number(event.target.value) } : current)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label><label className="block text-sm font-semibold">Preço promocional<input required type="number" min="0.01" step="0.01" value={offerForm.promoPrice} onChange={(event) => setOfferForm((current) => current ? { ...current, promoPrice: Number(event.target.value) } : current)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Início<input required type="date" value={offerForm.startsAt} onChange={(event) => setOfferForm((current) => current ? { ...current, startsAt: event.target.value } : current)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label><label className="block text-sm font-semibold">Término<input required type="date" value={offerForm.endsAt} onChange={(event) => setOfferForm((current) => current ? { ...current, endsAt: event.target.value } : current)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label></div>
              <p className="m-0 rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">
                Esta oferta dura {offerDurationDays(offerForm)} dia(s) corridos, contando as datas de início e término, e encerra às 23h59 (horário de Brasília) do último dia. O contador público usa esse prazo.
              </p>
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setOfferForm(null)} className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" className="flex-1 rounded-xl bg-emerald-800 py-3 font-bold text-white hover:bg-emerald-700">Salvar oferta</button></div>
            </form>
          </section>
        </div>
      )}

      {productModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px] overflow-y-auto"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !productFormSaving) {
              setProductModal(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <Package size={13} />
                  {productModal.mode === 'create' ? 'Novo Cadastro' : 'Edição de Produto'}
                </span>
                <h2
                  id="product-dialog-title"
                  className="m-0 mt-1.5 text-xl font-black text-slate-900 sm:text-2xl"
                >
                  {productModal.mode === 'create'
                    ? 'Cadastrar Novo Produto'
                    : `Editar: ${productModal.product?.name ?? 'Produto'}`}
                </h2>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  {productModal.mode === 'create'
                    ? 'Preencha as informações para adicionar o produto ao catálogo e encarte.'
                    : 'Atualize os dados, imagem, categoria/setor e valores salvos no Supabase.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductModal(null)}
                disabled={productFormSaving}
                aria-label="Fechar formulário de produto"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                  Nome do Produto <span className="text-red-500">*</span>
                  <input
                    required
                    maxLength={120}
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex.: Maçã Gala Selecionada 1kg"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Marca
                  <input
                    maxLength={80}
                    value={productForm.brand}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, brand: e.target.value }))
                    }
                    placeholder="Ex.: Fazenda Verde"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Categoria / Setor <span className="text-red-500">*</span>
                    <select
                      value={productForm.category}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-700"
                    >
                      {existingProductCategories.map((cat: string) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="custom">+ Outro setor personalizado...</option>
                    </select>
                  </label>
                  {productForm.category === 'custom' && (
                    <input
                      required
                      maxLength={50}
                      value={productForm.customCategory}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          customCategory: e.target.value,
                        }))
                      }
                      placeholder="Digite o nome da nova categoria"
                      className="w-full rounded-xl border border-emerald-300 bg-emerald-50/50 px-3.5 py-2 text-sm outline-none focus:border-emerald-700"
                    />
                  )}
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Unidade de Medida
                  <select
                    value={productForm.unit}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-700"
                  >
                    {STANDARD_PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Preço Normal (R$) <span className="text-red-500">*</span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={productForm.normalPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        normalPrice: e.target.value,
                      }))
                    }
                    placeholder="0,00"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-700"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Preço Promocional (R$)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={productForm.offerPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        offerPrice: e.target.value,
                      }))
                    }
                    placeholder="Opcional"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-emerald-800 outline-none focus:border-emerald-700"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">
                    Preço com desconto no catálogo
                  </span>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Estoque (Qtd)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, stock: e.target.value }))
                    }
                    placeholder="Ilimitado"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">
                    Vazio = sem limite de estoque
                  </span>
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Descrição do Produto
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detalhes sobre o produto, procedência, peso ou dicas de consumo..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="block text-sm font-bold text-slate-900">
                  Imagem do Produto
                </label>
                <p className="mb-3 mt-0.5 text-xs text-slate-500">
                  Envie uma foto do seu computador ou informe um link direto de imagem.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    {productForm.image ? (
                      <Image
                        src={productForm.image}
                        alt="Prévia do produto"
                        fill
                        sizes="96px"
                        className="object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Package size={26} />
                        <span className="text-[10px] font-semibold">Sem foto</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={productFormUploading}
                        onClick={() => productImageInput.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Upload size={15} />
                        {productFormUploading ? 'Enviando imagem...' : 'Enviar foto do computador'}
                      </button>
                      <input
                        ref={productImageInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => void handleProductImageUpload(e)}
                      />
                      {productForm.image && (
                        <button
                          type="button"
                          onClick={() =>
                            setProductForm((prev) => ({ ...prev, image: '' }))
                          }
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>

                    <input
                      type="url"
                      value={productForm.image}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, image: e.target.value }))
                      }
                      placeholder="Ou cole a URL da imagem (https://...)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700"
                    />
                    <p className="m-0 text-[11px] text-slate-400">
                      Formatos aceitos: JPG, PNG, WebP até 5 MB. A foto é salva no Supabase Storage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Seção no Panfleto
                  <select
                    value={productForm.flyerPage}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        flyerPage: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700"
                  >
                    <option value="">Não incluir no panfleto</option>
                    {FLYER_SECTION_OPTIONS.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Selo / Destaque
                  <input
                    maxLength={60}
                    value={productForm.badge}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, badge: e.target.value }))
                    }
                    placeholder="Ex.: Destaque da Semana"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-700"
                  />
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={productForm.active}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
                  />
                  <span>Produto ativo no site</span>
                </label>
              </div>

              {productFormError && (
                <p
                  role="alert"
                  className="m-0 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800"
                >
                  {productFormError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {productModal.mode === 'edit' && productModal.product ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteProduct(productModal.product!)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:underline"
                  >
                    <Trash2 size={14} />
                    Excluir produto
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={productFormSaving}
                    onClick={() => setProductModal(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={productFormSaving || productFormUploading}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check size={16} />
                    {productFormSaving
                      ? 'Salvando no Supabase...'
                      : productModal.mode === 'create'
                        ? 'Cadastrar Produto'
                        : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  trend,
  color,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  trend: string;
  color: 'emerald' | 'orange' | 'blue' | 'purple';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-800',
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-violet-50 text-violet-700',
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><span className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}><Icon size={20} /></span><p className="m-0 text-sm font-semibold text-slate-500">{label}</p><p className="mb-1 mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p><p className="m-0 text-xs text-slate-400">{trend}</p></article>;
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return <button type="button" onClick={onClick} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-bold transition hover:border-emerald-300 hover:bg-emerald-50"><span className="flex items-center gap-3"><Icon size={18} className="text-emerald-800" />{label}</span><ChevronRight size={16} className="text-slate-400" /></button>;
}
