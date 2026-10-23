import type { Metadata } from 'next';
import { BadgePercent, Sparkles } from 'lucide-react';
import {
  Breadcrumbs,
  ShopHeader,
} from '../shop-components';
import { getCatalogProducts } from '@/lib/catalog';
import {
  FlyerArtwork,
  FlyerCatalogSections,
  FlyerTitle,
  FlyerValidity,
} from './flyer-meta';
import FlashOffersSection from '../flash-offers-section';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return getLocalPageMetadata({
    title: 'Panfleto de Ofertas e promoções',
    description:
      'Confira ofertas de hortifrúti, açougue e supermercado válidas na sua região.',
    path: '/panfleto-de-ofertas',
    keywords: ['encarte de supermercado', 'ofertas de mercado'],
  });
}

export default async function FlyerPage() {
  const products = await getCatalogProducts();

  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Panfleto de Ofertas' }]} />

        <section className="relative mb-10 overflow-hidden rounded-3xl bg-emerald-900 px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-2xl" />
          <div className="relative">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
              <Sparkles size={15} />
              Ofertas da semana
            </p>
            <FlyerTitle />
            <p className="mb-6 max-w-xl text-sm leading-6 text-emerald-50/80 sm:text-base">
              Confira as ofertas da semana e adicione seus favoritos à sacola
              sem sair do panfleto.
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">
              <FlyerValidity />
            </div>
          </div>
          <div className="absolute bottom-8 right-8 hidden h-24 w-24 items-center justify-center rounded-full bg-orange-500 text-white shadow-xl sm:flex">
            <div className="text-center">
              <BadgePercent size={30} className="mx-auto" />
              <span className="text-xs font-black">DA SEMANA</span>
            </div>
          </div>
        </section>

        <FlashOffersSection products={products} />

        <FlyerArtwork products={products} />

        <FlyerCatalogSections products={products} />
      </div>
    </main>
  );
}
