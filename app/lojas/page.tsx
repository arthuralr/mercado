import { StoresPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Lojas, endereços e horários',
    description: 'Encontre endereços, telefones, horários e rotas das lojas próximas.',
    path: '/lojas',
    keywords: ['supermercado próximo', 'endereço supermercado'],
  });
}

export default function Page() {
  return <StoresPage />;
}
