'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BadgePercent,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileSpreadsheet,
  FileUp,
  LayoutDashboard,
  LogOut,
  Inbox,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Settings2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { CatalogProduct } from '@/lib/catalog-types';
import type { AdminFlyer, AdminOffer } from '../admin-data-provider';
import { currentStoreDate } from '@/lib/site-settings';
import { supabaseBrowser } from '@/lib/supabase-browser';
import {
  fetchAdminOffers,
  fetchAdminProducts,
  fetchFlyer,
  fetchTodayOrderCount,
  fetchTodayMetrics,
  importProductPrices,
  persistFlyer,
  persistOffer,
  persistProduct,
  removeOffer as removeOfferFromDatabase,
} from '@/lib/admin-database';
import AdminExtraPanel from './extra-panel';
import PushNotificationPanel from './push-panel';

type Section = 'overview' | 'offers' | 'products' | 'flyer' | 'settings' | 'submissions' | 'calendar' | 'push';
type OfferForm = Omit<AdminOffer, 'id'> & { id: string };

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const sectionInfo: Record<Section, { label: string; icon: typeof LayoutDashboard }> = {
  overview: { label: 'Visão geral', icon: LayoutDashboard },
  offers: { label: 'Ofertas relâmpago', icon: BadgePercent },
  products: { label: 'Produtos e preços', icon: Package },
  flyer: { label: 'Panfleto de Ofertas', icon: FileSpreadsheet },
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
  return offer.startsAt <= today && offer.endsAt >= today;
}

function offerDurationDays(offer: Pick<AdminOffer, 'startsAt' | 'endsAt'>) {
  const start = Date.parse(`${offer.startsAt}T00:00:00Z`);
  const end = Date.parse(`${offer.endsAt}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function parseCsv(text: string): string[][] {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) ?? []).length >
    (text.split(/\r?\n/, 1)[0].match(/,/g) ?? []).length
    ? ';'
    : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
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
  const [products, setProducts] = useState(initialProducts);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMessage, setCsvMessage] = useState('');
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerTitle, setFlyerTitle] = useState('');
  const [flyerValidUntil, setFlyerValidUntil] = useState('');
  const [flyerMessage, setFlyerMessage] = useState('');
  const [flyerPreview, setFlyerPreview] = useState('');
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
    void Promise.all([
      fetchAdminProducts(),
      fetchAdminOffers(),
      fetchTodayOrderCount(),
      fetchTodayMetrics(),
      fetchFlyer(),
    ])
      .then(([loadedProducts, loadedOffers, todayOrders, todayMetrics, loadedFlyer]) => {
        if (!active) return;
        setProducts(loadedProducts);
        setOffers(loadedOffers);
        setOrderCount(todayOrders);
        setTodayVisits(todayMetrics.visits);
        setTodayFlyerViews(todayMetrics.flyerViews);
        setFlyer(loadedFlyer);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido ao carregar o painel.';
        setActionError(message);
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);

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

  const activeOffersCount = offers.filter(isOfferActive).length;
  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.brand} ${product.category}`
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
      setOffers(await fetchAdminOffers());
      setOfferForm(null);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar a oferta.');
    }
  }

  async function removeOffer(offer: AdminOffer) {
    try {
      await removeOfferFromDatabase(offer.id);
      setOffers((current) => current.filter((item) => item.id !== offer.id));
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
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar o produto.');
    }
  }

  async function importPriceList() {
    if (!csvFile) return;
    setCsvMessage('');
    try {
      const csvRows = parseCsv(await csvFile.text());
      if (csvRows.length < 2) throw new Error('O CSV precisa conter cabeçalho e ao menos uma linha.');
      const headers = csvRows[0].map((header) => header.toLowerCase().trim());
      const idIndex = headers.indexOf('id');
      const priceIndex = headers.indexOf('preco_normal');
      const stockIndex = headers.indexOf('estoque');
      if (idIndex < 0 || priceIndex < 0) {
        throw new Error('Use as colunas obrigatórias "id" e "preco_normal"; "estoque" é opcional.');
      }
      const ids = new Set<string>();
      const rows = csvRows.slice(1).map((values, index) => {
        const id = values[idIndex]?.trim();
        const rawPrice = values[priceIndex]?.trim().replace(',', '.');
        const price = Number(rawPrice);
        const stockInput = stockIndex < 0 ? '' : values[stockIndex]?.trim() ?? '';
        const stock = stockInput ? Number(stockInput) : null;
        if (!id || !Number.isFinite(price) || price < 0 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
          throw new Error(`Dados inválidos na linha ${index + 2}. Confira ID, preço e estoque.`);
        }
        if (ids.has(id)) throw new Error(`O produto "${id}" aparece mais de uma vez no CSV.`);
        ids.add(id);
        return { id, preco_normal: price, ...(stockIndex >= 0 ? { estoque: stock } : {}) };
      });
      const updatedCount = await importProductPrices(rows);
      setProducts(await fetchAdminProducts());
      setCsvFile(null);
      setCsvMessage(`${updatedCount} preço(s) importado(s) e aplicado(s) ao catálogo.`);
      router.refresh();
    } catch (error) {
      setCsvMessage(error instanceof Error ? error.message : 'Não foi possível importar a lista.');
    }
  }

  function saveFlyerMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flyerFile && !flyer) {
      setFlyerMessage('Escolha um arquivo de imagem ou PDF para continuar.');
      return;
    }
    if (!flyerTitle.trim() || !flyerValidUntil) {
      setFlyerMessage('Informe o título e a data de validade do encarte.');
      return;
    }
    const file = flyerFile;
    const current: AdminFlyer = {
      title: flyerTitle.trim(),
      validUntil: flyerValidUntil,
      fileName: file?.name ?? flyer?.fileName ?? '',
      fileType: file?.type ?? flyer?.fileType ?? '',
      fileSize: file?.size ?? flyer?.fileSize ?? 0,
    };
    void persistFlyer(current, file ?? undefined)
      .then((savedFlyer) => {
        setFlyer(savedFlyer);
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
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Área administrativa</p>
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
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Entre com uma conta criada no Supabase Auth e cadastrada em
            <code className="mx-1">public.gestores</code>.
          </div>
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
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800 text-white"><Store size={21} /></span>
            <span>
              <strong className="block leading-5 text-emerald-950">VerdeVale</strong>
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
          <div className="mt-6 hidden rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 lg:block">
            <ShieldCheck size={18} className="mb-2" />
            O acesso e as alterações são autorizados pelo Supabase Auth e pelas políticas RLS.
          </div>
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
                <Metric icon={BadgePercent} label="Ofertas ativas" value={String(activeOffersCount)} trend="Consulta em ofertas_relampago" color="orange" />
                <Metric icon={Eye} label="Visualizações do encarte hoje" value={todayFlyerViews === null ? '—' : String(todayFlyerViews)} trend="Visitantes únicos/dia" color="blue" />
                <Metric icon={Users} label="Visitas ao site hoje" value={todayVisits === null ? '—' : String(todayVisits)} trend="Visitantes únicos/dia" color="purple" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div><h2 className="m-0 text-lg font-black">Atalhos de gestão</h2><p className="mb-0 mt-1 text-sm text-slate-500">Acesse as tarefas mais comuns.</p></div>
                    <Activity className="text-emerald-700" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <QuickAction icon={BadgePercent} label="Criar uma oferta" onClick={() => { beginOffer(); setSection('offers'); }} />
                    <QuickAction icon={Package} label="Editar produtos" onClick={() => setSection('products')} />
                    <QuickAction icon={FileUp} label="Atualizar encarte" onClick={() => setSection('flyer')} />
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2 text-amber-900"><ShieldCheck size={20} /><h2 className="m-0 text-base font-black">Métricas disponíveis</h2></div>
                  <p className="m-0 text-sm leading-6 text-amber-900/80">Pedidos e ofertas vêm do banco. Visualizações e acessos aparecem como “—” até uma solução de analytics ser conectada.</p>
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
                  {!activeOffersCount && <p className="py-4 text-sm text-slate-500">Nenhuma oferta ativa no momento.</p>}
                </div>
              </div>
            </div>
          )}

          {(section === 'settings' || section === 'submissions' || section === 'calendar') && (
            <AdminExtraPanel section={section} />
          )}

          {section === 'offers' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="m-0 text-sm text-emerald-950"><strong>{activeOffersCount}</strong> oferta(s) com validade vigente.</p>
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
                {!offers.length && <p className="p-8 text-center text-sm text-slate-500">Nenhuma oferta cadastrada. Crie a primeira promoção.</p>}
              </div>
            </div>
          )}

          {section === 'push' && <PushNotificationPanel />}

          {section === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"><Search size={18} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por produto, marca ou categoria" className="w-full bg-transparent text-sm outline-none" aria-label="Buscar produtos no painel" /></label>
                <button type="button" onClick={() => csvInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"><FileSpreadsheet size={17} /> Importar lista CSV</button>
                <input ref={csvInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { setCsvFile(event.target.files?.[0] ?? null); setCsvMessage(''); }} />
              </div>
              {csvFile && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><span><strong>{csvFile.name}</strong> selecionado · cabeçalhos <code>id,preco_normal,estoque</code></span><div className="flex gap-2"><button type="button" onClick={() => void importPriceList()} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Importar preços</button><button type="button" onClick={() => { setCsvFile(null); setCsvMessage(''); }} aria-label="Cancelar seleção de CSV" className="rounded-lg p-2 text-slate-600 hover:bg-white"><X size={16} /></button></div></div>}
              {csvMessage && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{csvMessage}</p>}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold">Produto</th><th className="px-4 py-3 font-bold">Categoria</th><th className="px-4 py-3 font-bold">Preço (R$)</th><th className="px-4 py-3 font-bold">Estoque</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Ação</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => {
                      const active = product.active ?? true;
                      const draft = productDrafts[product.id];
                      return <tr key={product.id} className="align-middle">
                        <td className="max-w-72 px-4 py-3"><span className="block truncate text-sm font-bold">{product.name}</span><span className="text-xs text-slate-500">{product.brand}</span></td>
                        <td className="px-4 py-3 text-sm text-slate-600">{product.category}</td>
                        <td className="px-4 py-3"><input type="number" min="0" step="0.01" aria-label={`Preço de ${product.name}`} value={draft?.price ?? String(product.oldPrice ?? product.price)} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { price: event.target.value, stock: current[product.id]?.stock ?? String(product.stock ?? '') } }))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></td>
                        <td className="px-4 py-3"><input type="number" min="0" step="1" aria-label={`Estoque de ${product.name}`} value={draft?.stock ?? String(product.stock ?? '')} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { price: current[product.id]?.price ?? String(product.oldPrice ?? product.price), stock: event.target.value } }))} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></td>
                        <td className="px-4 py-3"><button type="button" onClick={() => void persistProduct(product.id, { active: !active }).then(() => { setProducts((current) => current.map((item) => item.id === product.id ? { ...item, active: !active } : item)); router.refresh(); }).catch((error: unknown) => setActionError(error instanceof Error ? error.message : 'Não foi possível alterar o status do produto.'))} aria-pressed={active} className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Ativo' : 'Inativo'}</button></td>
                        <td className="px-4 py-3"><button type="button" onClick={() => saveProduct(product)} disabled={!draft} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">Salvar</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
                {!filteredProducts.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>}
              </div>
              <p className="text-xs leading-5 text-slate-500">Importação CSV funcional: informe IDs existentes e os cabeçalhos <code>id,preco_normal</code>, com a coluna opcional <code>estoque</code>. A gravação é transacional e rejeita o arquivo inteiro se algum ID/preço estiver inválido.</p>
            </div>
          )}

          {section === 'flyer' && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <form onSubmit={saveFlyerMetadata} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div><h2 className="m-0 text-lg font-black">Encarte da semana</h2><p className="mb-0 mt-1 text-sm text-slate-500">Cadastre a arte e informe até quando ela é válida.</p></div>
                <label className="block text-sm font-semibold">Título do encarte<input required value={flyerTitle} onChange={(event) => setFlyerTitle(event.target.value)} placeholder="Ex.: Ofertas da semana" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" /></label>
                <label className="block text-sm font-semibold">Válido até<input required type="date" value={flyerValidUntil} onChange={(event) => setFlyerValidUntil(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-emerald-700" /></label>
                <input ref={flyerInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; setFlyerMessage(''); if (file && !file.type.startsWith('image/') && file.type !== 'application/pdf') { setFlyerMessage('Formato não suportado. Escolha uma imagem ou PDF.'); return; } if (file && file.size > 10 * 1024 * 1024) { setFlyerMessage('O arquivo precisa ter no máximo 10 MB para a pré-visualização.'); return; } if (flyerPreview) URL.revokeObjectURL(flyerPreview); setFlyerFile(file); setFlyerPreview(file ? URL.createObjectURL(file) : ''); }} />
                <button type="button" onClick={() => flyerInput.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center hover:bg-emerald-50"><Upload size={24} className="text-emerald-800" /><span className="font-bold text-emerald-950">{flyerFile?.name ?? flyer?.fileName ?? 'Selecionar imagem ou PDF'}</span><span className="text-xs text-slate-500">PNG, JPG ou PDF · até 10 MB</span></button>
                {flyerMessage && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{flyerMessage}</p>}
                <button type="submit" className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white hover:bg-emerald-700"><Check size={17} className="mr-2 inline" />Salvar informações do encarte</button>
                <p className="m-0 text-xs leading-5 text-slate-500">O arquivo e os metadados são publicados no Supabase Storage e PostgreSQL para todas as pessoas que acessarem a loja.</p>
              </form>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="mb-4 mt-0 text-lg font-black">Pré-visualização</h2>
                {flyerPreview && flyerFile?.type.startsWith('image/') ? <Image src={flyerPreview} alt="Prévia do encarte selecionado" width={800} height={1000} unoptimized className="max-h-[520px] w-full rounded-xl object-contain" /> : flyerPreview && (flyerFile?.type === 'application/pdf' || flyer?.fileUrl?.toLowerCase().includes('.pdf')) ? <iframe src={flyerPreview} title="Prévia do PDF do encarte" className="h-[520px] w-full rounded-xl border border-slate-200" /> : flyer ? <div className="rounded-xl bg-slate-50 p-5">{flyer.fileUrl && <Image src={flyer.fileUrl} alt="Encarte publicado" width={800} height={1000} unoptimized className="mb-4 max-h-[360px] w-full rounded-xl object-contain" />}<p className="mb-1 mt-0 font-bold">{flyer.title}</p><p className="mb-0 mt-0 text-sm text-slate-500">{flyer.fileName}</p><p className="mb-0 mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Válido até {new Date(`${flyer.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</p></div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400"><div><FileUp size={30} className="mx-auto mb-2" />Selecione uma arte para pré-visualizar</div></div>}
              </section>
            </div>
          )}
        </section>
      </div>

      <footer className="mx-auto w-full max-w-[1500px] px-4 pb-6 text-center text-xs text-slate-400 sm:px-6 lg:px-8">VerdeVale · Painel administrativo demonstrativo · Dados de pedidos e visitas são ilustrativos</footer>

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
