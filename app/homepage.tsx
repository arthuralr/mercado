'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useShoppingCart } from './cart-provider';
import { useOnlineSales, useSiteSettings } from './admin-data-provider';
import BrandLogo from './brand-logo';
import CategoryShowcase from './category-showcase';
import FlashOffersSection from './flash-offers-section';
import { formatOfferCountdown } from './shop-components';
import {
  openQuickShoppingList,
  ShoppingListCalloutBanner,
  useQuickShoppingListCount,
} from './shopping-list-tool';
import { OfficialSocialLinks } from './social-links';
import { useManagedProducts } from './admin-data-provider';
import type { CatalogProduct } from '@/lib/catalog-types';
import {
  Apple,
  ArrowRight,
  BadgePercent,
  Beef,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Croissant,
  Heart,
  Leaf,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Truck,
  Wine,
  X,
} from 'lucide-react';

type Product = CatalogProduct & { image: string; rating: number };

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const departments = [
  { name: 'Hortifrúti', icon: Apple, color: 'text-[var(--brand-primary)]' },
  { name: 'Açougue', icon: Beef, color: 'text-[var(--brand-primary)]' },
  { name: 'Padaria', icon: Croissant, color: 'text-[var(--brand-primary)]' },
  { name: 'Bebidas', icon: Wine, color: 'text-[var(--brand-primary)]' },
  { name: 'Mercearia', icon: ShoppingBasket, color: 'text-[var(--brand-primary)]' },
  { name: 'Limpeza', icon: Sparkles, color: 'text-[var(--brand-primary)]' },
];

const campaignThemes = [
  'from-emerald-950/95 via-emerald-900/80 to-emerald-900/5',
  'from-slate-950/95 via-slate-900/75 to-slate-900/5',
  'from-orange-950/95 via-orange-900/80 to-orange-900/5',
];

const tabs = ['Mais vendidos', 'Feirinha de hortifrúti', 'Carnes e churrasco'];

function formatPrice(value: number) {
  return currency.format(value);
}

export default function HomePage({ products }: { products: Product[] }) {
  const router = useRouter();
  const managedProducts = useManagedProducts(products);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(0);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [now, setNow] = useState(0);
  const {
    itemCount: cartCount,
    total: cartTotal,
    addToCart,
    openCart,
  } = useShoppingCart();
  const { settings, venda_online_ativa } = useSiteSettings();
  const quickListCount = useQuickShoppingListCount();
  const campaigns = settings.banners.campaigns;
  const campaignCount = Math.max(campaigns.length, 1);
  const branches = settings.institution.branches;
  const activeBranchDetails =
    branches.find((branch) => branch.id === activeBranchId) ?? branches[0];
  const activeBranch = activeBranchDetails?.name ?? settings.institution.storeName;
  const cleanWhatsappDigits = settings.channels.whatsappNumber.replace(/\D/g, '');
  const whatsappDigits = cleanWhatsappDigits.length >= 10 ? cleanWhatsappDigits : '551140044040';
  const whatsappUrl = `https://wa.me/${whatsappDigits}`;

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (campaignCount < 2) return;
    const interval = window.setInterval(() => {
      setActiveCampaign(
        (current) => (Math.min(current, campaignCount - 1) + 1) % campaignCount,
      );
    }, 6500);
    return () => window.clearInterval(interval);
  }, [campaignCount]);

  const activeCampaignIndex = Math.min(activeCampaign, campaignCount - 1);

  const filteredSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return [];
    return managedProducts
      .filter((product) =>
        product.active !== false &&
        `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
      )
      .slice(0, 4);
  }, [managedProducts, query]);

  const visibleProducts = useMemo(() => {
    let result = managedProducts.filter((product) => product.active !== false);
    if (favoriteFilter) {
      result = result.filter((product) => favorites.includes(product.id));
    } else if (selectedDepartment) {
      result = result.filter(
        (product) =>
          product.category.toLocaleLowerCase('pt-BR') ===
          selectedDepartment.toLocaleLowerCase('pt-BR'),
      );
    } else if (activeTab === 'Feirinha de hortifrúti') {
      result = result.filter((product) => product.category === 'Hortifrúti');
    } else if (activeTab === 'Carnes e churrasco') {
      result = result.filter((product) => product.category === 'Açougue');
    }
    return result;
  }, [
    activeTab,
    favoriteFilter,
    favorites,
    managedProducts,
    selectedDepartment,
  ]);

  const departmentCounts = useMemo(
    () =>
      Object.fromEntries(
        departments.map(({ name }) => [
          name,
          managedProducts.filter(
            (product) =>
              product.active !== false &&
              product.category.toLocaleLowerCase('pt-BR') ===
                name.toLocaleLowerCase('pt-BR'),
          ).length,
        ]),
      ),
    [managedProducts],
  );

  function selectDepartment(category: string) {
    setSelectedDepartment(category);
    setFavoriteFilter(false);
    if (category) setActiveTab(tabs[0]);
    window.requestAnimationFrame(() => {
      document
        .getElementById('vitrines')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const currentCampaign = campaigns[activeCampaignIndex];
  const currentCampaignTheme =
    campaignThemes[activeCampaignIndex % campaignThemes.length];

  function changeCampaign(direction: number) {
    setActiveCampaign(
      (current) =>
        (Math.min(current, campaignCount - 1) + direction + campaignCount) %
        campaignCount,
    );
  }

  function toggleFavorite(productId: string) {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function selectSuggestion(product: Product) {
    setQuery(product.name);
    setSearchFocused(false);
    router.push(`/produtos/${product.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-slate-800">
      <header className={`sticky ${settings.topbar.enabled && settings.topbar.text ? 'top-8' : 'top-0'} z-40 border-b border-slate-200 bg-white shadow-sm`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 lg:gap-6 lg:px-8">
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <BrandLogo />

          <div className="relative hidden shrink-0 md:block">
            <button
              type="button"
              onClick={() => setBranchMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
              aria-expanded={branchMenuOpen}
            >
              <MapPin size={19} className="text-emerald-700" />
              <span className="max-w-36">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {venda_online_ativa ? 'Você está comprando em' : 'Unidade selecionada'}
                </span>
                <span className="block truncate text-sm font-bold text-slate-800">
                  {activeBranch}
                </span>
              </span>
              <ChevronDown size={16} className="text-slate-500" />
            </button>
            {branchMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Escolha uma filial
                </p>
                {branches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        setActiveBranchId(branch.id);
                        setBranchMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                    >
                      {branch.name}
                      {activeBranch === branch.name && (
                        <Check size={16} className="text-emerald-700" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="relative order-1 min-w-0 flex-1">
            <form
              className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 transition focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-700/10"
              onSubmit={(event) => {
                event.preventDefault();
                if (filteredSuggestions[0]) selectSuggestion(filteredSuggestions[0]);
              }}
              role="search"
            >
              <Search size={19} className="ml-3 shrink-0 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                placeholder="O que você procura hoje?"
                aria-label="Buscar produtos"
                aria-autocomplete="list"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQuery('')}
                  className="mr-3 text-slate-400 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              )}
            </form>
            {searchFocused && query.trim() && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                {filteredSuggestions.length ? (
                  filteredSuggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onMouseDown={() => selectSuggestion(product)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-emerald-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{product.name}</span>
                        <span className="text-xs text-slate-500">{product.category}</span>
                      </span>
                      <span className="text-sm font-bold text-emerald-800">
                        {formatPrice(product.price)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="m-0 px-3 py-4 text-sm text-slate-500">
                    Nenhum produto encontrado. Tente buscar por categoria.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFavoriteFilter((active) => !active)}
            aria-pressed={favoriteFilter}
            className={`relative inline-flex rounded-xl p-2.5 transition ${
              favoriteFilter ? 'bg-rose-50 text-rose-600' : 'text-slate-600 hover:bg-slate-100'
            }`}
            aria-label={`Favoritos${favorites.length ? `, ${favorites.length} itens` : ''}`}
          >
            <Heart size={22} fill={favoriteFilter ? 'currentColor' : 'none'} />
            {favorites.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {favorites.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openQuickShoppingList}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2.5 text-xs font-extrabold text-amber-950 shadow-2xs transition hover:bg-amber-200 sm:px-3.5"
            aria-label="Abrir Crie sua Lista de Compras"
          >
            <ClipboardList size={18} className="shrink-0 text-amber-900" />
            <span className="hidden md:inline">Crie sua Lista</span>
            {quickListCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[11px] font-black text-amber-300">
                {quickListCount}
              </span>
            )}
          </button>
          {settings.channels.whatsappEnabled && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Atendimento via WhatsApp"
              className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:brightness-95 lg:inline-flex"
            >
              <MessageCircle size={17} />
              <span>WhatsApp</span>
            </a>
          )}
          <OfficialSocialLinks variant="header" className="hidden xl:inline-flex" />
          {venda_online_ativa ? (
            <button
              type="button"
              onClick={openCart}
              className="relative flex shrink-0 items-center gap-2.5 rounded-xl bg-red-600 px-3.5 py-2.5 font-extrabold text-white shadow-md ring-1 ring-red-700/20 transition hover:bg-red-700 active:scale-[0.99] sm:px-4"
              aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}, total ${formatPrice(cartTotal)}`}
            >
              <ShoppingCart size={20} className="text-white" />
              <span className="hidden text-sm tracking-tight sm:inline">Carrinho</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-black text-red-700 shadow-xs">
                {cartCount}
              </span>
            </button>
          ) : (
            <Link
              href="/lojas"
              className="hidden shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 sm:inline-flex"
            >
              <Store size={17} className="text-emerald-700" />
              <span>Consulte na loja física</span>
            </Link>
          )}
          {venda_online_ativa && (
            <Link href="/conta" aria-label="Minha conta" className="hidden rounded-xl p-2.5 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 sm:inline-flex">
              <LogIn size={21} />
            </Link>
          )}
          <div className="relative order-1 basis-[36%] md:hidden">
            <button
              type="button"
              onClick={() => setBranchMenuOpen((open) => !open)}
              aria-expanded={branchMenuOpen}
              className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-900"
            >
              <MapPin size={16} className="text-emerald-700" />
              <span className="flex-1">
                <span className="text-xs text-slate-500">Sua loja:</span>{' '}
                <span className="font-bold">{activeBranch}</span>
              </span>
              <ChevronDown size={16} />
            </button>
            {branchMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {branches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        setActiveBranchId(branch.id);
                        setBranchMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                    >
                      {branch.name}
                      {activeBranch === branch.name && (
                        <Check size={16} className="text-emerald-700" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <nav
          aria-label="Departamentos"
          className={`${mobileMenuOpen ? 'block' : 'hidden'} border-t border-slate-100 lg:block`}
        >
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 lg:justify-center lg:px-8">
            {departments.map(({ name, icon: Icon, color }) => (
              <Link
                key={name}
                href={`/catalogo?departamento=${encodeURIComponent(name)}`}
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Icon size={18} className={color} />
                {name}
              </Link>
            ))}
            <Link
              href="/panfleto-de-ofertas"
              className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-extrabold text-red-700 shadow-2xs transition hover:border-red-300 hover:bg-red-100 hover:text-red-800"
            >
              <BadgePercent size={18} className="text-red-600" />
              Panfleto de Ofertas
            </Link>
            <button
              type="button"
              onClick={openQuickShoppingList}
              className="flex shrink-0 items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-extrabold text-amber-950 shadow-2xs transition hover:border-amber-400 hover:bg-amber-200"
            >
              <ClipboardList size={18} className="text-amber-900" />
              Crie sua Lista de Compras
              {quickListCount > 0 && (
                <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[11px] font-black text-amber-300">
                  {quickListCount}
                </span>
              )}
            </button>
            <Link
              href="/receitas"
              className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Leaf size={18} />
              Receitas
            </Link>
            {venda_online_ativa && (
              <Link
                href="/conta"
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Minha conta
              </Link>
            )}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-5 lg:px-8">
        <nav aria-label="Você está em" className="text-xs text-slate-500">
          <span>Início</span>
          <span className="mx-2">/</span>
          <span className="font-semibold text-slate-700">{activeBranch}</span>
        </nav>
      </div>

      <section
        aria-label="Campanhas em destaque"
        className="mx-auto mt-4 max-w-7xl px-4 lg:px-8"
      >
        <div className="relative isolate min-h-[360px] overflow-hidden rounded-[2rem] bg-emerald-950 sm:min-h-[420px]">
          <Image
            key={currentCampaign.id}
            src={currentCampaign.image}
            alt={currentCampaign.title}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            unoptimized
            className="absolute inset-0 -z-20 object-cover"
          />
          <div
            className={`absolute inset-0 -z-10 bg-gradient-to-r ${currentCampaignTheme}`}
          />
          <div className="relative flex min-h-[360px] items-center px-7 py-10 sm:min-h-[420px] sm:px-14 lg:px-20">
            <div className="max-w-xl text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <Sparkles size={14} />
                {currentCampaign.eyebrow}
              </span>
              <h1 className="mb-4 mt-5 max-w-lg text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {currentCampaign.title}
              </h1>
              <p className="mb-7 max-w-md text-sm leading-6 text-white/85 sm:text-base">
                {currentCampaign.subtitle}
              </p>
              <a
                href="#vitrines"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-500"
              >
                {currentCampaign.button}
                <ArrowRight size={17} />
              </a>
            </div>
          </div>
          <div className="absolute bottom-5 right-5 flex items-center gap-2 sm:bottom-7 sm:right-7">
            <button
              type="button"
              onClick={() => changeCampaign(-1)}
              aria-label="Campanha anterior"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1.5 px-1">
              {campaigns.map((campaign, index) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setActiveCampaign(index)}
                  aria-label={`Ir para campanha ${index + 1}`}
                  aria-current={activeCampaignIndex === index}
                  className={`h-2 rounded-full transition-all ${
                    activeCampaignIndex === index ? 'w-7 bg-white' : 'w-2 bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => changeCampaign(1)}
              aria-label="Próxima campanha"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="absolute right-7 top-7 hidden items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm md:flex">
            <Store size={15} />
            Ofertas da sua loja
          </div>
        </div>
      </section>

      {(settings.banners.secondaryImage || settings.banners.tertiaryImage) && (
        <section aria-label="Banners de ofertas" className="mx-auto grid max-w-7xl gap-4 px-4 pt-6 sm:grid-cols-2 lg:px-8">
          {[settings.banners.secondaryImage, settings.banners.tertiaryImage].filter(Boolean).map((image, index) => (
            <Link key={`${index}-${image}`} href="/panfleto-de-ofertas" className="relative block aspect-[2/1] overflow-hidden rounded-2xl bg-emerald-50">
              <Image src={image} alt={`Campanha ${settings.institution.storeName} ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
            </Link>
          ))}
        </section>
      )}

      <FlashOffersSection
        products={managedProducts}
        favorites={favorites}
        onFavorite={toggleFavorite}
      />

      <ShoppingListCalloutBanner />

      <CategoryShowcase
        selected={selectedDepartment}
        counts={departmentCounts}
        onSelect={selectDepartment}
      />

      <section
        id="vitrines"
        className="mx-auto max-w-7xl scroll-mt-36 px-4 pb-14 pt-12 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Escolhas que valem a pena
            </p>
            <h2 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Feito para a sua lista
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setFavoriteFilter(false);
              setSelectedDepartment('');
              setActiveTab(tabs[0]);
            }}
            className="hidden items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-600 sm:inline-flex"
          >
            Ver todos os produtos <ArrowRight size={16} />
          </button>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setFavoriteFilter(false);
                setSelectedDepartment('');
              }}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                !favoriteFilter && activeTab === tab
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFavoriteFilter(true);
              setSelectedDepartment('');
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
              favoriteFilter
                ? 'bg-rose-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
            }`}
          >
            <Heart size={15} fill={favoriteFilter ? 'currentColor' : 'none'} />
            Favoritos
          </button>
        </div>

        {visibleProducts.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                now={now}
                favorite={favorites.includes(product.id)}
                onFavorite={() => toggleFavorite(product.id)}
                onAdd={() => addToCart(product)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Heart size={28} className="mx-auto text-rose-400" />
            <p className="mb-0 mt-3 font-semibold text-slate-700">
              {favoriteFilter
                ? 'Ainda não há favoritos por aqui.'
                : `Nenhum produto encontrado em ${selectedDepartment || activeTab}.`}
            </p>
            <p className="mb-0 mt-1 text-sm text-slate-500">
              {favoriteFilter
                ? 'Toque no coração de um produto para salvá-lo.'
                : 'Escolha outro corredor ou veja todos os produtos.'}
            </p>
          </div>
        )}
      </section>

      <section className="border-y border-emerald-100 bg-emerald-50/70">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 lg:px-8">
          {venda_online_ativa ? (
            <>
              <Benefit icon={Truck} title="Entrega com carinho" text="Receba suas compras fresquinhas no mesmo dia." />
              <Benefit icon={ShieldCheck} title="Compra segura" text="Seus dados protegidos em todas as etapas." />
              <Benefit icon={Leaf} title="Fresquinho de verdade" text="Seleção diária de produtores parceiros." />
            </>
          ) : (
            <>
              <Benefit icon={Store} title="Catálogo de ofertas" text="Confira preços e promoções atualizados das nossas unidades." />
              <Benefit icon={BadgePercent} title="Economia toda semana" text="Acompanhe o panfleto digital e ofertas relâmpago." />
              <Benefit icon={Leaf} title="Fresquinho de verdade" text="Seleção diária de produtores parceiros na loja física." />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function ProductCard({
  product,
  now,
  favorite,
  onFavorite,
  onAdd,
}: {
  product: Product;
  now: number;
  favorite: boolean;
  onFavorite: () => void;
  onAdd: () => void;
}) {
  const { venda_online_ativa } = useOnlineSales();
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : null;
  const countdown = formatOfferCountdown(product.flashOfferEndsAt, now);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <Link
          href={`/produtos/${product.id}`}
          aria-label={`Ver detalhes de ${product.name}`}
          className="absolute inset-0"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        </Link>
        {discount && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm sm:left-3 sm:top-3 sm:text-xs">
            <BadgePercent size={13} />
            -{discount}%
          </span>
        )}
        {product.badge && (
          <span className="absolute bottom-2 left-2 max-w-[75%] truncate rounded-md bg-zinc-900/90 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm sm:bottom-3 sm:left-3 sm:text-[10px]">
            {product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={onFavorite}
          aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
          aria-pressed={favorite}
          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105 sm:right-3 sm:top-3 ${
            favorite ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
          }`}
        >
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-1 flex items-center gap-1 text-amber-500">
          <Star size={12} fill="currentColor" />
          <span className="text-[11px] font-bold text-slate-600">{product.rating.toFixed(1)}</span>
          <span className="text-[10px] text-slate-400">· {product.category}</span>
        </div>
        <Link href={`/produtos/${product.id}`} className="mb-1 mt-0 block line-clamp-2 min-h-10 text-xs font-bold leading-5 text-slate-800 hover:text-emerald-800 sm:text-sm">
          {product.name}
        </Link>
        <p className="mb-3 mt-0 text-[10px] text-slate-500 sm:text-xs">{product.unit}</p>
        {product.flashOfferEndsAt && (
          <div
            className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-red-600 px-3 py-2 text-white shadow-sm"
            aria-label={
              countdown
                ? `Oferta de ${product.name} termina em ${countdown.hours} horas, ${countdown.minutes} minutos e ${countdown.seconds} segundos`
                : `Cronômetro da oferta de ${product.name}`
            }
            aria-live="off"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-white">
              <Clock3 size={15} className="shrink-0 text-yellow-300" />
              <span>Termina em</span>
            </span>
            <span className="rounded-lg bg-zinc-950/90 px-2.5 py-1 font-mono text-xs font-black tracking-widest text-white shadow-xs sm:text-sm">
              {countdown ? countdown.formatted : '--:--:--'}
            </span>
          </div>
        )}
        <div className="flex min-h-11 items-end justify-between gap-1">
          <div className="min-w-0">
            {product.oldPrice && (
              <p className="mb-0 mt-0 text-[10px] text-slate-400 line-through sm:text-xs">
                {formatPrice(product.oldPrice)}
              </p>
            )}
            <p className="mb-0 mt-0 text-sm font-black leading-5 text-emerald-800 sm:text-lg">
              {formatPrice(product.price)}
            </p>
          </div>
          {venda_online_ativa ? (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Adicionar ${product.name} ao carrinho`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 sm:h-10 sm:w-10"
            >
              <Plus size={19} />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
              <Store size={13} className="shrink-0 text-emerald-700" />
              <span className="hidden sm:inline">Consulte na loja</span>
              <span className="sm:hidden">Na loja</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function Benefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Truck;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
        <Icon size={22} />
      </span>
      <div>
        <h3 className="m-0 text-sm font-black text-slate-800">{title}</h3>
        <p className="mb-0 mt-1 text-xs leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}
