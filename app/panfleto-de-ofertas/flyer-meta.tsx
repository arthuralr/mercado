'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CalendarDays, Plus, ShoppingBasket, Store, X } from 'lucide-react';
import {
  useAdminData,
  useManagedProducts,
  useOnlineSales,
} from '../admin-data-provider';
import { useShoppingCart } from '../cart-provider';
import { ProductCard } from '../shop-components';
import type { CatalogProduct } from '@/lib/catalog-types';
import { isPdfFlyer } from '@/lib/flyer-file';

export const FLYER_PUBLIC_SECTIONS = [
  { id: 'capa', title: 'Destaques da semana', accent: 'bg-red-600' },
  { id: 'hortifruti', title: 'Feirinha fresquinha', accent: 'bg-emerald-700' },
  { id: 'acougue-bebidas', title: 'Açougue e bebidas', accent: 'bg-rose-700' },
  {
    id: 'mercearia-limpeza',
    title: 'Mercearia e casa',
    accent: 'bg-amber-600',
  },
] as const;

const sectionTitleById = new Map<string, string>(
  FLYER_PUBLIC_SECTIONS.map((section) => [section.id, section.title]),
);

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function FlyerTitle() {
  const { data } = useAdminData();
  return (
    <h1 className="mb-3 mt-0 text-3xl font-black sm:text-5xl">
      {data.flyer?.title || 'Ofertas que dão gosto.'}
    </h1>
  );
}

export function FlyerValidity() {
  const { data } = useAdminData();
  if (!data.flyer?.validUntil) {
    return (
      <>
        <CalendarDays size={17} />
        Ofertas válidas enquanto durarem os estoques
      </>
    );
  }
  return (
    <>
      <CalendarDays size={17} />
      Válido até{' '}
      {new Date(`${data.flyer.validUntil.slice(0, 10)}T12:00:00`).toLocaleDateString(
        'pt-BR',
      )}
    </>
  );
}

export function FlyerArtwork({ products }: { products: CatalogProduct[] }) {
  const managedProducts = useManagedProducts(products);
  const { data, selectFlyer } = useAdminData();
  const { addToCart } = useShoppingCart();
  const { venda_online_ativa } = useOnlineSales();
  const [now, setNow] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(
    null,
  );
  useEffect(() => {
    const updateCurrentTime = () => setNow(Date.now());
    updateCurrentTime();
    const interval = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const linkedProducts = managedProducts.filter((product) => {
    if (product.active === false) return false;
    const inFlyerSection = Boolean(product.flyerPage?.trim());
    const isFeatured = Boolean(product.badge?.trim());
    const hasFlyerDiscount =
      product.oldPrice !== null && product.oldPrice > product.price;
    const offerEndsAt = Date.parse(product.flashOfferEndsAt ?? '');
    const hasActiveOffer =
      Number.isFinite(offerEndsAt) && (now === 0 || offerEndsAt > now);
    return inFlyerSection || isFeatured || hasFlyerDiscount || hasActiveOffer;
  });

  const activeSelectedProduct = selectedProduct
    ? managedProducts.find((item) => item.id === selectedProduct.id) ??
      selectedProduct
    : null;

  const hasArtwork = Boolean(data.flyer?.fileUrl);
  if (!hasArtwork && !linkedProducts.length) return null;

  return (
    <>
      <section aria-label="Encarte e produtos em destaque" className="mb-10">
        {data.flyers.length > 1 && (
          <div
            className="mb-4 flex gap-2 overflow-x-auto pb-2"
            aria-label="Escolha um encarte"
          >
            {data.flyers.map((flyer) => (
              <button
                key={flyer.id}
                type="button"
                aria-pressed={data.flyer?.id === flyer.id}
                onClick={() => selectFlyer(flyer.id)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                  data.flyer?.id === flyer.id
                    ? 'border-emerald-800 bg-emerald-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-800'
                }`}
              >
                {flyer.title}
              </button>
            ))}
          </div>
        )}
        <div
          className={`grid items-start gap-5 ${
            hasArtwork
              ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]'
              : ''
          }`}
        >
          {hasArtwork && data.flyer && (
            <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {isPdfFlyer(data.flyer.fileName, data.flyer.fileType) ? (
                <iframe
                  src={data.flyer.fileUrl}
                  title={data.flyer.title}
                  className="h-[70vh] min-h-96 w-full"
                />
              ) : (
                <Image
                  src={data.flyer.fileUrl ?? ''}
                  alt={data.flyer.title}
                  width={1600}
                  height={2000}
                  unoptimized
                  className="mx-auto max-h-[80vh] w-full object-contain"
                />
              )}
            </div>
          )}

          <aside
            aria-labelledby="flyer-products-title"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
              <h2
                id="flyer-products-title"
                className="m-0 text-base font-black text-slate-900"
              >
                Ofertas do encarte
              </h2>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                {venda_online_ativa
                  ? 'Selecione um produto para ver o preço e adicionar à sacola.'
                  : 'Selecione um produto para conferir os detalhes da oferta.'}
              </p>
            </div>
            {linkedProducts.length ? (
              <ul className="m-0 max-h-[70vh] list-none divide-y divide-slate-100 overflow-y-auto p-0">
                {linkedProducts.map((product) => {
                  const sectionName = product.flyerPage
                    ? sectionTitleById.get(product.flyerPage)
                    : undefined;
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-emerald-50"
                        aria-label={`Ver oferta de ${product.name}, ${currency.format(product.price)}`}
                      >
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt=""
                            width={56}
                            height={56}
                            sizes="56px"
                            className="h-14 w-14 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                            <ShoppingBasket size={22} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          {(Boolean(product.badge?.trim()) || sectionName) && (
                            <span className="mb-1 flex flex-wrap items-center gap-1.5">
                              {Boolean(product.badge?.trim()) && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                  {product.badge}
                                </span>
                              )}
                              {sectionName && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  {sectionName}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="block truncate text-sm font-bold text-slate-800">
                            {product.name}
                          </span>
                          <span className="mt-1 flex items-baseline gap-2">
                            {product.oldPrice !== null &&
                              product.oldPrice > product.price && (
                                <span className="text-[11px] text-slate-400 line-through">
                                  {currency.format(product.oldPrice)}
                                </span>
                              )}
                            <span className="text-xs font-black text-emerald-800">
                              {currency.format(product.price)}
                            </span>
                          </span>
                        </span>
                        <Plus size={18} className="shrink-0 text-emerald-800" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 p-5 text-sm text-slate-500">
                Nenhum produto em destaque ou com oferta ativa disponível no
                momento.
              </p>
            )}
          </aside>
        </div>
      </section>

      {activeSelectedProduct && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="flyer-product-dialog-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {activeSelectedProduct.badge || 'Oferta do encarte'}
                </p>
                <h2
                  id="flyer-product-dialog-title"
                  className="m-0 text-xl font-black text-slate-900"
                >
                  {activeSelectedProduct.name}
                </h2>
                <p className="mb-0 mt-1 text-sm text-slate-500">
                  {activeSelectedProduct.unit} · {activeSelectedProduct.brand}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Fechar oferta"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            {activeSelectedProduct.image && (
              <div className="relative aspect-[4/3] bg-slate-50">
                <Image
                  src={activeSelectedProduct.image}
                  alt={activeSelectedProduct.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 448px"
                  className="object-contain"
                />
              </div>
            )}
            <div className="space-y-4 p-5 pt-4">
              {activeSelectedProduct.oldPrice !== null && (
                <p className="m-0 text-sm text-slate-500">
                  De{' '}
                  <span className="line-through">
                    {currency.format(activeSelectedProduct.oldPrice)}
                  </span>
                </p>
              )}
              <p className="m-0 text-3xl font-black text-emerald-800">
                {currency.format(activeSelectedProduct.price)}
              </p>
              {venda_online_ativa && (
                <button
                  type="button"
                  onClick={() => {
                    addToCart(activeSelectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white hover:bg-emerald-700"
                >
                  <Plus size={18} />
                  Adicionar ao carrinho
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function FlyerCatalogSections({
  products,
}: {
  products: CatalogProduct[];
}) {
  const managedProducts = useManagedProducts(products);
  const sections = FLYER_PUBLIC_SECTIONS.map((section) => ({
    ...section,
    products: managedProducts.filter((product) => {
      if (product.active === false) return false;
      if (product.flyerPage === section.id) return true;
      if (
        section.id === 'capa' &&
        !product.flyerPage &&
        Boolean(product.badge?.trim())
      ) {
        return true;
      }
      return false;
    }),
  })).filter((section) => section.products.length > 0);

  return (
    <>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800"
          >
            {section.title}
          </a>
        ))}
      </div>

      {sections.length ? (
        <div className="space-y-12">
          {sections.map((section) => (
            <section
              id={section.id}
              key={section.id}
              className="scroll-mt-36"
              aria-labelledby={`${section.id}-title`}
            >
              <div className="mb-5 flex items-center gap-3">
                <span className={`h-9 w-1.5 rounded-full ${section.accent}`} />
                <div>
                  <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Panfleto da semana
                  </p>
                  <h2
                    id={`${section.id}-title`}
                    className="m-0 text-2xl font-black text-slate-900"
                  >
                    {section.title}
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                {section.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          O panfleto está sendo atualizado. Volte em breve para conferir as
          ofertas.
        </div>
      )}
    </>
  );
}
