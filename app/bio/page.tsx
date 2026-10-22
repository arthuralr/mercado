import { BioPage } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Links oficiais e ofertas',
    description: 'Acesse o catálogo, Panfleto de Ofertas, clube de descontos e contatos oficiais.',
    path: '/bio',
  });
}

export default function Page() {
  return <BioPage />;
}
