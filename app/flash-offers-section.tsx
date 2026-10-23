'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Zap } from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog-types';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { currentStoreDate } from '@/lib/site-settings';
import { isMissingRelationError } from '@/lib/supabase-errors';
import { formatOfferCountdown, ProductCard } from './shop-components';
import { useManagedProducts } from './admin-data-provider';

interface FlashOfferRow {
  id?: string;
  produto_id: string | number;
  preco_promocional: number | string;
  data_inicio: string;
  data_fim: string;
}

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

export default function FlashOffersSection({
  products,
  favorites,
  onFavorite,
}: {
  products: CatalogProduct[];
  favorites?: string[];
  onFavorite?: (productId: string) => void;
}) {
  const managedProducts = useManagedProducts(products);
  const [now, setNow] = useState(0);
  const [offerRows, setOfferRows] = useState<FlashOfferRow[] | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const loadOffers = () => {
      void supabaseBrowser
        .from('ofertas_relampago')
        .select('id, produto_id, preco_promocional, data_inicio, data_fim')
        .order('data_inicio', { ascending: false })
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            if (!isMissingRelationError(error)) {
              console.error('Não foi possível carregar ofertas relâmpago.', error);
            }
            return;
          }
          setOfferRows((data ?? []) as FlashOfferRow[]);
        });
    };

    loadOffers();
    const channel = supabaseBrowser
      .channel('public-flash-offers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ofertas_relampago' },
        loadOffers,
      )
      .subscribe();

    return () => {
      active = false;
      void supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const enrichedProducts = useMemo(() => {
    if (offerRows === null) return managedProducts;
    const today = currentStoreDate();

    return managedProducts.map((product) => {
      const productOffers = offerRows.filter(
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
          flashOfferEndsAt: resolveOfferEndsAt(activeOffer.data_fim),
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
  }, [managedProducts, offerRows]);

  const activeProducts = useMemo(
    () =>
      enrichedProducts.filter(
        (product) =>
          product.active !== false &&
          product.flashOfferEndsAt &&
          (now === 0 || Date.parse(product.flashOfferEndsAt) > now),
      ),
    [enrichedProducts, now],
  );

  const nearestEndIso = useMemo(() => {
    let nearestMs: number | null = null;
    let nearestIso: string | undefined;
    for (const product of activeProducts) {
      if (!product.flashOfferEndsAt) continue;
      const endMs = Date.parse(product.flashOfferEndsAt);
      if (!Number.isNaN(endMs) && (nearestMs === null || endMs < nearestMs)) {
        nearestMs = endMs;
        nearestIso = product.flashOfferEndsAt;
      }
    }
    return nearestIso;
  }, [activeProducts]);

  const nearestCountdown = formatOfferCountdown(nearestEndIso, now);

  if (!activeProducts.length) return null;

  return (
    <section
      id="ofertas-relampago"
      aria-labelledby="flash-offers-title"
      className="mx-auto max-w-7xl px-4 pb-4 pt-10 lg:px-8"
    >
      <div className="rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50/70 via-white to-white p-5 shadow-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-red-100 pb-5">
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-sm">
              <Zap size={14} className="text-yellow-300" fill="currentColor" />
              Em destaque · Só por tempo limitado
            </span>
            <h2
              id="flash-offers-title"
              className="m-0 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl"
            >
              Ofertas Relâmpago
            </h2>
            <p className="mb-0 mt-1 text-sm font-medium text-zinc-600">
              Aproveite descontos especiais antes que o cronômetro de cada oferta chegue ao fim.
            </p>
          </div>
          {nearestCountdown && (
            <div
              className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-md ring-1 ring-zinc-800"
              aria-label={`A oferta mais próxima termina em ${nearestCountdown.hours} horas, ${nearestCountdown.minutes} minutos e ${nearestCountdown.seconds} segundos`}
              aria-live="off"
            >
              <Clock3 size={18} className="shrink-0 text-red-400" />
              <span className="hidden text-xs font-extrabold uppercase tracking-wider text-zinc-300 sm:inline">
                Próximo encerramento
              </span>
              <span className="rounded-xl bg-red-600 px-3 py-1.5 font-mono text-base font-black tracking-widest text-white shadow-xs sm:text-lg">
                {nearestCountdown.formatted}
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {activeProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              now={now}
              favorite={favorites?.includes(product.id)}
              onFavorite={
                onFavorite ? () => onFavorite(product.id) : undefined
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
