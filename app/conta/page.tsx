import type { Metadata } from 'next';
import CustomerAccount from '../customer-account';
import { getCatalogProducts } from '@/lib/catalog';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata(): Promise<Metadata> {
  return getLocalPageMetadata({
    title: 'Minha conta',
    description: 'Acesse seus pedidos e listas de compras.',
    path: '/conta',
    noIndex: true,
  });
}

export const instant = false;

export default async function AccountPage() {
  const products = await getCatalogProducts();
  return <CustomerAccount products={products} />;
}
