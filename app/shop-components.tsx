'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgePercent,
  ChevronRight,
  ClipboardList,
  Clock3,
  MessageCircle,
  Minus,
  Plus,
  Heart,
  UserRound,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { useShoppingCart } from './cart-provider';
import { useOnlineSales, useSiteSettings } from './admin-data-provider';
import { useManagedProduct } from './admin-data-provider';
import {
  openQuickShoppingList,
  useQuickShoppingListCount,
} from './shopping-list-tool';
import { OfficialSocialLinks } from './social-links';
import { getStoreWhatsappUrl } from '@/lib/site-settings';
import type { CatalogProduct } from '@/lib/catalog-types';
import BrandLogo from './brand-logo';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatOfferCountdown(
  endsAt: string | undefined,
  now: number,
): {
  remainingSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  ariaLabel: string;
} | null {
  if (!endsAt || now <= 0) return null;
  const endMs = Date.parse(endsAt);
  if (Number.isNaN(endMs)) return null;
  const remainingSeconds = Math.max(0, Math.ceil((endMs - now) / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const formatted = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  const ariaLabel = `${days} ${days === 1 ? 'dia' : 'dias'}, ${hours} ${hours === 1 ? 'hora' : 'horas'} e ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  return {
    remainingSeconds,
    days,
    hours,
    minutes,
    seconds,
    formatted,
    ariaLabel,
  };
}

export function ShopHeader() {
  const { itemCount, total, openCart } = useShoppingCart();
  const { settings, venda_online_ativa } = useSiteSettings();
  const quickListCount = useQuickShoppingListCount();
  const whatsappUrl = getStoreWhatsappUrl(settings);

  return (
    <header className={`sticky ${settings.topbar.enabled && settings.topbar.text ? 'top-8' : 'top-0'} z-40 border-b border-slate-200 bg-white shadow-sm`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandLogo />

          <nav aria-label="Navegação da loja" className="hidden items-center gap-2 sm:flex">
            <Link
              href="/catalogo"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Catálogo
            </Link>
            <Link
              href="/panfleto-de-ofertas"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-extrabold text-red-700 transition hover:border-red-300 hover:bg-red-100 hover:text-red-800"
            >
              <BadgePercent size={16} className="text-red-600" />
              Panfleto de Ofertas
            </Link>
            <button
              type="button"
              onClick={openQuickShoppingList}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3.5 py-2 text-sm font-extrabold text-amber-950 transition hover:border-amber-400 hover:bg-amber-200"
            >
              <ClipboardList size={16} className="text-amber-900" />
              Crie sua Lista de Compras
              {quickListCount > 0 && (
                <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[11px] font-black text-amber-300">
                  {quickListCount}
                </span>
              )}
            </button>
            <Link
              href="/receitas"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Receitas
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {settings.channels.whatsappEnabled && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Atendimento via WhatsApp"
                className="hidden items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-extrabold text-white shadow-xs transition hover:brightness-95 lg:inline-flex"
              >
                <MessageCircle size={16} />
                <span>WhatsApp</span>
              </a>
            )}
            <OfficialSocialLinks variant="header" className="hidden xl:inline-flex" />
            {venda_online_ativa && (
              <Link href="/conta" aria-label="Minha conta" className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800">
                <UserRound size={20} />
              </Link>
            )}
            {venda_online_ativa && (
              <button
                type="button"
                onClick={openCart}
                aria-label={`Abrir carrinho, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}, total ${currency.format(total)}`}
                className="flex items-center gap-2.5 rounded-xl bg-red-600 px-3.5 py-2.5 font-extrabold text-white shadow-md ring-1 ring-red-700/20 transition hover:bg-red-700 active:scale-[0.99]"
              >
                <ShoppingCart size={19} className="text-white" />
                <span className="hidden sm:inline">Carrinho</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-black text-red-700 shadow-xs">
                  {itemCount}
                </span>
              </button>
            )}
          </div>
        </div>
        <nav aria-label="Navegação móvel" className="flex gap-1.5 border-t border-slate-100 px-3 py-2 sm:hidden">
          <Link href="/catalogo" className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-semibold">
            Catálogo
          </Link>
          <Link href="/panfleto-de-ofertas" className="min-w-0 flex-1 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-center text-xs font-extrabold text-red-700">
            Panfleto
          </Link>
          <button
            type="button"
            onClick={openQuickShoppingList}
            className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-amber-100 px-2 py-2 text-center text-xs font-extrabold text-amber-950"
          >
            Criar Lista{quickListCount > 0 ? ` (${quickListCount})` : ''}
          </button>
          <Link href="/receitas" className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-semibold">
            Receitas
          </Link>
        </nav>
    </header>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Você está em" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <Link href="/" className="hover:text-emerald-800">Início</Link>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
          <ChevronRight size={14} />
          {item.href ? (
            <Link href={item.href} className="hover:text-emerald-800">{item.label}</Link>
          ) : (
            <span className="font-semibold text-slate-800">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ProductImage({
  product,
  className = '',
}: {
  product: CatalogProduct;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-emerald-50 ${className}`}>
      {product.image ? (
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 250px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full min-h-24 items-center justify-center text-emerald-700">
          <Store size={32} />
        </div>
      )}
    </div>
  );
}

export function ProductCard({
  product: sourceProduct,
  favorite,
  onFavorite,
  now: externalNow,
}: {
  product: CatalogProduct;
  favorite?: boolean;
  onFavorite?: () => void;
  now?: number;
}) {
  const product = useManagedProduct(sourceProduct);
  const { venda_online_ativa } = useOnlineSales();
  const { cart, addToCart, changeQuantity } = useShoppingCart();
  const [localNow, setLocalNow] = useState(0);

  useEffect(() => {
    if (externalNow !== undefined || !product.flashOfferEndsAt) return;
    const update = () => setLocalNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [externalNow, product.flashOfferEndsAt]);

  if (product.active === false) return null;
  const quantity = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const currentNow = externalNow ?? localNow;
  const countdown = formatOfferCountdown(product.flashOfferEndsAt, currentNow);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative aspect-square">
        <Link
          href={`/produtos/${product.id}`}
          aria-label={`Ver detalhes de ${product.name}`}
          className="absolute inset-0 block"
        >
          <ProductImage product={product} className="absolute inset-0" />
        </Link>
        {(discount > 0 || Boolean(product.badge?.trim())) && (
          <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-3.25rem)] flex-wrap gap-1.5">
            {discount > 0 && (
              <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white shadow-sm">
                -{discount}%
              </span>
            )}
            {Boolean(product.badge?.trim()) && (
              <span className="truncate rounded-full bg-zinc-900/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                {product.badge}
              </span>
            )}
          </div>
        )}
        {onFavorite && (
          <button
            type="button"
            onClick={onFavorite}
            aria-label={
              favorite
                ? `Remover ${product.name} dos favoritos`
                : `Adicionar ${product.name} aos favoritos`
            }
            aria-pressed={favorite}
            className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ${
              favorite ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
            }`}
          >
            <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="mb-1 mt-0 text-xs font-semibold text-emerald-700">{product.category}</p>
        <Link href={`/produtos/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-bold text-slate-800 hover:text-emerald-800">
          {product.name}
        </Link>
        <p className="mb-3 mt-1 text-xs text-slate-500">{product.unit} · {product.brand}</p>
        {product.flashOfferEndsAt && (
          <div
            className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-red-600 px-3 py-2 text-white shadow-sm"
            aria-label={
              countdown
                ? `Oferta de ${product.name} termina em ${countdown.ariaLabel}`
                : `Cronômetro da oferta de ${product.name}`
            }
            aria-live="off"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-white">
              <Clock3 size={15} className="shrink-0 text-yellow-300" />
              <span>Termina em</span>
            </span>
            <span className="rounded-lg bg-zinc-950/90 px-2.5 py-1 font-mono text-xs font-black tracking-wide text-white shadow-xs sm:text-sm">
              {countdown ? countdown.formatted : '--d --h --m'}
            </span>
          </div>
        )}
        <div className="flex items-end justify-between gap-2">
          <div>
            {product.oldPrice !== null && (
              <p className="m-0 text-xs text-slate-400 line-through">{currency.format(product.oldPrice)}</p>
            )}
            <p className="m-0 text-lg font-black text-emerald-800">{currency.format(product.price)}</p>
          </div>
          {venda_online_ativa && (
            quantity ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-1">
                <button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`Diminuir quantidade de ${product.name}`} className="rounded-lg p-1.5 hover:bg-white">
                  <Minus size={16} />
                </button>
                <span className="min-w-5 text-center text-sm font-bold">{quantity}</span>
                <button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label={`Aumentar quantidade de ${product.name}`} className="rounded-lg p-1.5 hover:bg-white">
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => addToCart(product)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 sm:text-sm">
                <Plus size={16} />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 rounded-3xl bg-emerald-900 px-6 py-8 text-white sm:px-10 sm:py-10">
      <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">{eyebrow}</p>
      <h1 className="mb-3 mt-0 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      <p className="mb-0 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">{description}</p>
    </div>
  );
}

export function BackToCatalog() {
  return (
    <Link href="/catalogo" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-600">
      <ArrowLeft size={16} />
      Voltar ao catálogo
    </Link>
  );
}
