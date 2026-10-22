import { CareerPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Trabalhe Conosco',
    description: 'Confira como enviar seu currículo e candidatar-se a oportunidades na loja.',
    path: '/trabalhe-conosco',
  });
}

export default function Page() {
  return <CareerPage />;
}
