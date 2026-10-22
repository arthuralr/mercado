import { ClubPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Clube de ofertas e descontos',
    description: 'Cadastre-se para acompanhar ofertas, novidades e campanhas do supermercado.',
    path: '/clube',
  });
}

export default function Page() {
  return <ClubPage />;
}
