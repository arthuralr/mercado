import { AboutPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Quem somos',
    description: 'Conheça o supermercado, sua história, valores e atendimento na região.',
    path: '/sobre',
  });
}

export default function Page() {
  return <AboutPage />;
}
