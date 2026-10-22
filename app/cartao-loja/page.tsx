import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { CardRequestForm } from '../customer-forms';
import { ShopHeader } from '../shop-components';
import { getLocalPageMetadata } from '@/lib/local-seo';

export async function generateMetadata() {
  return getLocalPageMetadata({
    title: 'Cartão da Loja',
    description: 'Solicite contato da equipe para saber sobre o cartão e as condições da loja.',
    path: '/cartao-loja',
  });
}

export default function CardPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="text-sm font-bold text-emerald-800 hover:underline">← Início</Link>
        <header className="my-6 rounded-3xl bg-emerald-900 p-7 text-white sm:p-10">
          <CreditCard size={28} className="mb-3 text-emerald-200" />
          <h1 className="m-0 text-3xl font-black">Cartão da Loja</h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-emerald-100">Preencha um pré-cadastro para que nossa equipe possa entrar em contato. O envio não representa aprovação de crédito.</p>
        </header>
        <CardRequestForm />
      </div>
    </main>
  );
}
