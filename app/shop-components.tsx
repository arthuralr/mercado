'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Minus,
  Plus,
  Heart,
  UserRound,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { useShoppingCart } from './cart-provider';
import { useSiteSettings } from './admin-data-provider';
import { useManagedProduct } from './admin-data-provider';
import type { CatalogProduct } from '@/lib/catalog-types';
import BrandLogo from './brand-logo';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function ShopHeader() {
  const { itemCount, total, openCart } = useShoppingCart();
  const { settings } = useSiteSettings();

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
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Panfleto de Ofertas
            </Link>
            <Link
              href="/receitas"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Receitas
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/conta" aria-label="Minha conta" className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800">
              <UserRound size={20} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              aria-label={`Abrir carrinho, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}, total ${currency.format(total)}`}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 font-bold text-white transition hover:bg-orange-600"
            >
              <ShoppingCart size={19} />
              <span className="hidden sm:inline">Carrinho</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs text-orange-600">
                {itemCount}
              </span>
            </button>
          </div>
        </div>
        <nav aria-label="Navegação móvel" className="flex gap-2 border-t border-slate-100 px-3 py-2 sm:hidden">
          <Link href="/catalogo" className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-semibold">
            Catálogo
          </Link>
          <Link href="/panfleto-de-ofertas" className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-semibold">
            Panfleto
          </Link>
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
}: {
  product: CatalogProduct;
  favorite?: boolean;
  onFavorite?: () => void;
}) {
  const product = useManagedProduct(sourceProduct);
  const { settings } = useSiteSettings();
  const { cart, addToCart, changeQuantity } = useShoppingCart();
  if (product.active === false) return null;
  const quantity = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <Link href={`/produtos/${product.id}`} aria-label={`Ver detalhes de ${product.name}`}>
        <div className="relative aspect-square">
          <ProductImage product={product} className="absolute inset-0" />
          {discount > 0 && (
            <span className="absolute left-2 top-2 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-black text-white">
              -{discount}%
            </span>
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
      </Link>
      <div className="p-4">
        <p className="mb-1 mt-0 text-xs font-semibold text-emerald-700">{product.category}</p>
        <Link href={`/produtos/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-bold text-slate-800 hover:text-emerald-800">
          {product.name}
        </Link>
        <p className="mb-3 mt-1 text-xs text-slate-500">{product.unit} · {product.brand}</p>
        <div className="flex items-end justify-between gap-2">
          <div>
            {product.oldPrice !== null && (
              <p className="m-0 text-xs text-slate-400 line-through">{currency.format(product.oldPrice)}</p>
            )}
            <p className="m-0 text-lg font-black text-emerald-800">{currency.format(product.price)}</p>
          </div>
          {!settings.commerceEnabled ? (
            <span className="text-xs font-semibold text-slate-500">Vitrine</span>
          ) : quantity ? (
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
