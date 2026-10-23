import { CardPageView } from '../institutional';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Cartão da Loja',
    description: 'Solicite contato da equipe para saber sobre o cartão e as condições da loja.',
    path: '/cartao-loja',
  });
}

export default function CardPage() {
  return <CardPageView />;
}
