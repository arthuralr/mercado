import type { Metadata } from 'next';
import { BadgePercent, Sparkles } from 'lucide-react';
import {
  Breadcrumbs,
  ProductCard,
  ShopHeader,
} from '../shop-components';
import { getCatalogProducts } from '@/lib/catalog';
import { FlyerArtwork, FlyerTitle, FlyerValidity } from './flyer-meta';
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

const flyerSections = [
  { id: 'capa', title: 'Destaques da semana', accent: 'bg-orange-500' },
  { id: 'hortifruti', title: 'Feirinha fresquinha', accent: 'bg-emerald-700' },
  { id: 'acougue-bebidas', title: 'Açougue e bebidas', accent: 'bg-rose-700' },
  {
    id: 'mercearia-limpeza',
    title: 'Mercearia e casa',
    accent: 'bg-amber-600',
  },
];

export default async function FlyerPage() {
  const products = await getCatalogProducts();
  const sections = flyerSections
    .map((section) => ({
      ...section,
      products: products.filter((product) => product.flyerPage === section.id),
    }))
    .filter((section) => section.products.length > 0);

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
            O panfleto está sendo atualizado. Volte em breve para conferir as ofertas.
          </div>
        )}
      </div>
    </main>
  );
}
