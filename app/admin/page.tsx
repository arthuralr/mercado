import type { Metadata } from 'next';
import AdminDashboard from './panel';
import { getAdminProducts } from '@/lib/catalog';
import { getLocalSeoContext } from '@/lib/local-seo';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getLocalSeoContext();
  return {
    title: `Painel do gestor | ${storeName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage() {
  const products = await getAdminProducts();
  return <AdminDashboard products={products} />;
}
