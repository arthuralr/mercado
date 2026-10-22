import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '../../product-detail';
import { Breadcrumbs, ShopHeader } from '../../shop-components';
import { getCatalogProducts } from '@/lib/catalog';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const products = await getCatalogProducts();
  const product = products.find((item) => item.id === id);
  if (!product) {
    return getLocalPageMetadata({
      title: 'Produto indisponível',
      description: 'Este produto não está disponível no catálogo atual.',
      path: `/produtos/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  }
  const price = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);
  return getLocalPageMetadata({
    title: `${product.name} - ${product.category}`,
    description: `${product.name}, ${product.unit}, por ${price}. Veja disponibilidade e outros produtos no catálogo local.`,
    path: `/produtos/${encodeURIComponent(id)}`,
    keywords: [product.name, product.category, product.brand],
    image: product.image ?? undefined,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const products = await getCatalogProducts();
  const product = products.find((item) => item.id === id) ?? null;

  if (!product) {
    notFound();
  }

  const recommendations = products
    .filter((item) => item.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.category === product.category) -
        Number(a.category === product.category),
    )
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: 'Catálogo', href: '/catalogo' },
            { label: product.category, href: `/catalogo?departamento=${encodeURIComponent(product.category)}` },
            { label: product.name },
          ]}
        />
        <ProductDetail product={product} recommendations={recommendations} />
      </div>
    </main>
  );
}
