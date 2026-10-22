import { PrivacyPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Política de Privacidade',
    description: 'Leia como o supermercado utiliza e protege dados pessoais nos canais digitais.',
    path: '/privacidade',
  });
}

export default function Page() {
  return <PrivacyPage />;
}
