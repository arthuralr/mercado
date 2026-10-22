'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CalendarDays, Plus, ShoppingBasket, X } from 'lucide-react';
import { useAdminData } from '../admin-data-provider';
import { useShoppingCart } from '../cart-provider';
import { useSiteSettings } from '../admin-data-provider';
import type { CatalogProduct } from '@/lib/catalog-types';
import { isPdfFlyer } from '@/lib/flyer-file';

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
      {new Date(`${data.flyer.validUntil}T12:00:00`).toLocaleDateString(
        'pt-BR',
      )}
    </>
  );
}

export function FlyerArtwork({ products }: { products: CatalogProduct[] }) {
  const { data, selectFlyer } = useAdminData();
  const { addToCart } = useShoppingCart();
  const { settings } = useSiteSettings();
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

  const linkedProducts = products.filter(
    (product) => {
      if (product.active === false) return false;
      const isFeatured = Boolean(product.badge?.trim());
      const offerEndsAt = Date.parse(product.flashOfferEndsAt ?? '');
      const hasActiveOffer =
        Number.isFinite(offerEndsAt) && (now === 0 || offerEndsAt > now);
      return isFeatured || hasActiveOffer;
    },
  );
  const hasArtwork = Boolean(data.flyer?.fileUrl);
  if (!hasArtwork && !linkedProducts.length) return null;

  return (
    <>
      <section aria-label="Encarte e produtos em destaque" className="mb-10">
        {data.flyers.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2" aria-label="Escolha um encarte">
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
        <div className={`grid items-start gap-5 ${hasArtwork ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]' : ''}`}>
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
              <h2 id="flyer-products-title" className="m-0 text-base font-black text-slate-900">
                Ofertas do encarte
              </h2>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Selecione um produto para ver o preço e adicionar à sacola.
              </p>
            </div>
            {linkedProducts.length ? (
              <ul className="m-0 max-h-[70vh] list-none divide-y divide-slate-100 overflow-y-auto p-0">
                {linkedProducts.map((product) => (
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
                        <span className="block truncate text-sm font-bold text-slate-800">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-xs font-black text-emerald-800">
                          {currency.format(product.price)}
                        </span>
                      </span>
                      <Plus size={18} className="shrink-0 text-emerald-800" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 p-5 text-sm text-slate-500">
                Nenhum produto em destaque ou com oferta ativa disponível no momento.
              </p>
            )}
          </aside>
        </div>
      </section>

      {selectedProduct && (
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
                  Oferta do encarte
                </p>
                <h2 id="flyer-product-dialog-title" className="m-0 text-xl font-black text-slate-900">
                  {selectedProduct.name}
                </h2>
                <p className="mb-0 mt-1 text-sm text-slate-500">
                  {selectedProduct.unit} · {selectedProduct.brand}
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
            {selectedProduct.image && (
              <div className="relative aspect-[4/3] bg-slate-50">
                <Image
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 448px"
                  className="object-contain"
                />
              </div>
            )}
            <div className="space-y-4 p-5 pt-4">
              {selectedProduct.oldPrice !== null && (
                <p className="m-0 text-sm text-slate-500">
                  De{' '}
                  <span className="line-through">
                    {currency.format(selectedProduct.oldPrice)}
                  </span>
                </p>
              )}
              <p className="m-0 text-3xl font-black text-emerald-800">
                {currency.format(selectedProduct.price)}
              </p>
              {settings.commerceEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white hover:bg-emerald-700"
                >
                  <Plus size={18} />
                  Adicionar ao carrinho
                </button>
              ) : (
                <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Compras online pausadas. Consulte a disponibilidade com a loja.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
