'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Zap } from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog-types';
import { ProductCard } from './shop-components';

export default function FlashOffersSection({
  products,
  favorites,
  onFavorite,
}: {
  products: CatalogProduct[];
  favorites?: string[];
  onFavorite?: (productId: string) => void;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.active !== false &&
          product.flashOfferEndsAt &&
          (now === 0 || Date.parse(product.flashOfferEndsAt) > now),
      ),
    [now, products],
  );
  const nearestEnd = activeProducts.reduce<number | null>((nearest, product) => {
    const end = Date.parse(product.flashOfferEndsAt!);
    return nearest === null || end < nearest ? end : nearest;
  }, null);
  const remainingSeconds =
    nearestEnd === null || now === 0
      ? null
      : Math.max(0, Math.ceil((nearestEnd - now) / 1000));
  const hours =
    remainingSeconds === null ? null : Math.floor(remainingSeconds / 3600);
  const minutes =
    remainingSeconds === null ? null : Math.floor((remainingSeconds % 3600) / 60);
  const seconds =
    remainingSeconds === null ? null : remainingSeconds % 60;

  if (!activeProducts.length) return null;

  return (
    <section
      aria-labelledby="flash-offers-title"
      className="mx-auto max-w-7xl px-4 pb-4 pt-12 lg:px-8"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
            <Zap size={15} fill="currentColor" />
            Só por tempo limitado
          </p>
          <h2
            id="flash-offers-title"
            className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
          >
            Ofertas Relâmpago
          </h2>
        </div>
        {remainingSeconds !== null && (
          <div
            className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700"
            aria-label={`A oferta mais próxima termina em ${hours} horas, ${minutes} minutos e ${seconds} segundos`}
            aria-live="off"
          >
            <Clock3 size={17} />
            <span className="hidden sm:inline">Termina em</span>
            <span className="rounded-md bg-orange-600 px-2 py-1 font-mono text-white">
              {String(hours).padStart(2, '0')}:
              {String(minutes).padStart(2, '0')}:
              {String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {activeProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            favorite={favorites?.includes(product.id)}
            onFavorite={
              onFavorite ? () => onFavorite(product.id) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
