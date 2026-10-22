import HomePage from './homepage';
import { getCatalogProducts } from '@/lib/catalog';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Mercado fresco com ofertas e entrega',
    description:
      'Compre frutas, verduras e carnes com ofertas fresquinhas e entrega de supermercado na sua região.',
    path: '/',
  });
}

export default async function Page() {
  const products = await getCatalogProducts();
  const homeProducts = products.map((product) => ({
    ...product,
    image:
      product.image ??
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=85',
    rating: 4.8,
  }));

  return <HomePage products={homeProducts} />;
}
