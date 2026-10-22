import type { Metadata } from 'next';
import AdminDashboard from './panel';
import { getAdminProducts } from '@/lib/catalog';

export const instant = false;

export const metadata: Metadata = {
  title: 'Painel do gestor | VerdeVale',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const products = await getAdminProducts();
  return <AdminDashboard products={products} />;
}
