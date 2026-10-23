'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Store } from 'lucide-react';
import BrandLogo from '../brand-logo';
import { useOnlineSales } from '../admin-data-provider';

interface Product {
  id: string | number;
  name: string;
  description: string | null;
  price: number | string;
  image_url?: string | null;
  image?: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface StorefrontProps {
  storeName: string;
  products: Product[];
  initialOnlineSales?: boolean;
}

const priceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatPrice(price: number | string) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice)
    ? priceFormatter.format(numericPrice)
    : 'Preço indisponível';
}

export default function Storefront({
  storeName,
  products,
  initialOnlineSales,
}: StorefrontProps) {
  const { venda_online_ativa } = useOnlineSales(initialOnlineSales);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.product.price) * item.quantity,
    0,
  );

  function addToCart(product: Product) {
    if (!venda_online_ativa) return;
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.product.id === product.id,
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...currentCart, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: Product['id'], change: number) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: Product['id']) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.product.id !== productId),
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <BrandLogo name={storeName} compact />
          {venda_online_ativa ? (
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Abrir carrinho, ${itemCount} itens, total ${formatPrice(cartTotal)}`}
              className="rounded-xl bg-red-600 px-4 py-2 text-left text-white shadow-sm transition hover:bg-red-700"
            >
              <span className="block font-semibold">
                Carrinho <span aria-hidden="true">({itemCount})</span>
              </span>
              <span className="text-sm text-white/90">
                {formatPrice(cartTotal)}
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700">
              <Store size={15} className="text-emerald-700" />
              Catálogo de ofertas
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-emerald-400/30 bg-slate-900 p-8">
          <h2 className="mb-2 mt-0 text-3xl font-extrabold">
            Bem-vindo ao {storeName}!
          </h2>
          <p className="m-0 text-slate-400">
            {venda_online_ativa
              ? 'Confira os produtos disponíveis na nossa loja e faça seu pedido online.'
              : 'Confira nosso catálogo digital de ofertas. Consulte a disponibilidade na loja física.'}
          </p>
        </section>

        <section className="mt-10" aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="mb-6 text-2xl font-bold">
            Nosso catálogo
          </h2>

          {products.length === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-300">
              O catálogo está vazio no momento. Volte em breve para conferir
              nossas novidades!
            </p>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const imageUrl = product.image_url ?? product.image;

                return (
                  <li
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:-translate-y-1 hover:border-emerald-400/50"
                  >
                    {imageUrl ? (
                      <div className="relative h-52">
                        <Image
                          src={imageUrl}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        role="img"
                        aria-label={`Imagem indisponível para ${product.name}`}
                        className="flex h-52 items-center justify-center bg-slate-800 text-sm text-slate-400"
                      >
                        Imagem indisponível
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="mb-2 mt-0 text-lg font-bold">
                        {product.name}
                      </h3>
                      <p className="mb-5 mt-0 min-h-10 text-sm leading-5 text-slate-400">
                        {product.description || 'Sem descrição disponível.'}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="m-0 text-lg font-bold text-emerald-400">
                          {formatPrice(product.price)}
                        </p>
                        {venda_online_ativa && (
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {isCartOpen && venda_online_ativa && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="relative flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <h2 id="cart-title" className="m-0 text-xl font-bold">
                O seu carrinho
              </h2>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                aria-label="Fechar carrinho"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Fechar
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="m-0 p-6 text-center text-slate-400">
                O carrinho está vazio. Adicione produtos do catálogo para
                começar.
              </p>
            ) : (
              <ul className="flex-1 list-none space-y-4 overflow-y-auto p-5">
                {cart.map(({ product, quantity }) => (
                  <li
                    key={product.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="m-0 font-semibold">{product.name}</h3>
                        <p className="mb-0 mt-1 text-sm text-emerald-400">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="text-sm text-slate-400 underline hover:text-white"
                        aria-label={`Remover ${product.name} do carrinho`}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, -1)}
                          aria-label={`Diminuir quantidade de ${product.name}`}
                          className="h-8 w-8 rounded-lg border border-slate-700 hover:bg-slate-800"
                        >
                          −
                        </button>
                        <span aria-label={`Quantidade: ${quantity}`}>
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, 1)}
                          aria-label={`Aumentar quantidade de ${product.name}`}
                          className="h-8 w-8 rounded-lg border border-slate-700 hover:bg-slate-800"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-semibold">
                        {formatPrice(Number(product.price) * quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-slate-800 p-5">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-emerald-400">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
