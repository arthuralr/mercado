import type { Metadata } from 'next';
import { Breadcrumbs, ShopHeader } from '../shop-components';
import RecipeSuggestions from '../recipe-suggestions';
import { getCatalogProducts } from '@/lib/catalog';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return getLocalPageMetadata({
    title: 'Receitas e Sugestões do Dia',
    description:
      'Encontre receitas práticas, confira ingredientes do supermercado e adicione produtos à sua sacola.',
    path: '/receitas',
    keywords: ['receitas fáceis', 'receitas com ingredientes de supermercado'],
  });
}

export default async function RecipesPage() {
  const products = await getCatalogProducts();

  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Receitas e Sugestões do Dia' }]} />
      </div>
      <RecipeSuggestions products={products} />
    </main>
  );
}
