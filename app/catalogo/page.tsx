import type { Metadata } from 'next';
import CatalogListing from '../catalog-listing';
import {
  Breadcrumbs,
  PageIntro,
  ShopHeader,
} from '../shop-components';
import { getCatalogProducts } from '@/lib/catalog';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

interface CatalogPageProps {
  searchParams: Promise<{
    departamento?: string;
    busca?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const { departamento, busca } = await searchParams;
  const department = departamento?.trim();
  const categoryDescription =
    department?.toLocaleLowerCase('pt-BR').includes('hort')
      ? 'Compre frutas, legumes e verduras frescas'
      : department?.toLocaleLowerCase('pt-BR').includes('açougue')
        ? 'Encontre cortes e carnes selecionadas do açougue'
        : department
          ? `Encontre produtos de ${department}`
          : 'Explore hortifrúti, açougue, mercearia e produtos para sua casa';
  return getLocalPageMetadata({
    title: department ? `${department} no catálogo` : 'Catálogo de produtos',
    description: `${categoryDescription} com preços e ofertas locais.`,
    path: department
      ? `/catalogo?departamento=${encodeURIComponent(department)}`
      : '/catalogo',
    keywords: department ? [department] : [],
    noIndex: Boolean(busca),
  });
}

export default async function CatalogPage({
  searchParams,
}: CatalogPageProps) {
  const [{ departamento, busca }, products] = await Promise.all([
    searchParams,
    getCatalogProducts(),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Catálogo' }]} />
        <PageIntro
          eyebrow="Tudo para sua casa"
          title={departamento ?? 'Nosso catálogo'}
          description="Encontre seus favoritos com praticidade. Use os filtros para chegar rapidinho ao que você precisa."
        />
        <CatalogListing
          products={products}
          initialDepartment={departamento}
          initialSearch={busca}
        />
      </div>
    </main>
  );
}
