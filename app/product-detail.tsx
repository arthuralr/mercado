'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Minus, Plus, ShieldCheck, ShoppingCart, Store } from 'lucide-react';
import { useShoppingCart } from './cart-provider';
import { useManagedProduct, useOnlineSales } from './admin-data-provider';
import {
  ProductCard,
  ProductImage,
} from './shop-components';
import type { CatalogProduct } from '@/lib/catalog-types';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function ProductDetail({
  product: sourceProduct,
  recommendations,
}: {
  product: CatalogProduct;
  recommendations: CatalogProduct[];
}) {
  const product = useManagedProduct(sourceProduct);
  const { venda_online_ativa } = useOnlineSales();
  const { addToCart } = useShoppingCart();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(product.image);

  function addSelectedQuantity() {
    addToCart({ ...product, image: activeImage }, quantity);
  }

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : null;

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-white shadow-sm">
            {activeImage ? (
              <Image
                src={activeImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <ProductImage product={product} className="absolute inset-0" />
            )}
            {discount && (
              <span className="absolute left-4 top-4 rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm">
                {discount}% OFF
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setActiveImage(product.image)}
              aria-label="Ver imagem principal do produto"
              aria-pressed={activeImage === product.image}
              className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 bg-white ${
                activeImage === product.image
                  ? 'border-emerald-700'
                  : 'border-transparent'
              }`}
            >
              <ProductImage product={product} className="absolute inset-0" />
            </button>
            <p className="m-0 self-center text-xs text-slate-500">
              Imagens ilustrativas. A apresentação pode variar conforme a filial.
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          <p className="mb-2 mt-0 text-sm font-bold text-emerald-700">
            {product.category} · {product.brand}
          </p>
          <h1 className="mb-3 mt-0 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            {product.name}
          </h1>
          <p className="mb-6 mt-0 text-sm text-slate-500">
            Conteúdo: <strong className="text-slate-700">{product.unit}</strong>
          </p>

          {product.oldPrice !== null && (
            <p className="mb-0 mt-0 text-sm text-slate-400 line-through">
              De {currency.format(product.oldPrice)}
            </p>
          )}
          <p className="mb-1 mt-1 text-3xl font-black text-emerald-800">
            {currency.format(product.price)}
          </p>
          {discount && (
            <p className="mb-6 mt-0 text-sm font-bold text-red-700">
              Você economiza {currency.format(product.oldPrice! - product.price)}
            </p>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            {product.stock !== null && product.stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                <Check size={15} />
                Disponível na loja
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                Consulte disponibilidade
              </span>
            )}
            {venda_online_ativa ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <ShieldCheck size={16} className="text-emerald-700" />
                Compra segura
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Store size={16} className="text-emerald-700" />
                Catálogo de ofertas
              </span>
            )}
          </div>

          {venda_online_ativa && (
            <>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    aria-label="Diminuir quantidade"
                    className="rounded-lg p-2 hover:bg-slate-100"
                  >
                    <Minus size={17} />
                  </button>
                  <span className="min-w-6 text-center font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => current + 1)}
                    aria-label="Aumentar quantidade"
                    className="rounded-lg p-2 hover:bg-slate-100"
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addSelectedQuantity}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-red-700"
                >
                  <ShoppingCart size={19} />
                  Adicionar à sacola
                </button>
              </div>

              <p className="m-0 text-xs text-slate-500">
                Total dos itens selecionados:{' '}
                <strong className="text-slate-800">
                  {currency.format(product.price * quantity)}
                </strong>
              </p>
            </>
          )}

          <section className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="mb-2 mt-0 text-lg font-black">Sobre este produto</h2>
            <p className="mb-0 mt-0 whitespace-pre-line text-sm leading-6 text-slate-600">
              {product.description || 'Descrição não disponível no momento.'}
            </p>
            {product.restrictions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.restrictions.map((restriction) => (
                  <span
                    key={restriction}
                    className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                  >
                    {restriction}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="mb-2 mt-0 text-xl font-black">Informação nutricional</h2>
        <p className="mb-4 mt-0 text-sm text-slate-500">
          Os dados nutricionais não foram disponibilizados para este produto.
          Consulte a embalagem para obter as informações completas e atualizadas.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-left text-sm">
            <caption className="sr-only">Tabela de informação nutricional</caption>
            <thead>
              <tr className="bg-emerald-50 text-emerald-950">
                <th scope="col" className="rounded-l-lg p-3">Porção</th>
                <th scope="col" className="p-3">Valor energético</th>
                <th scope="col" className="p-3">Carboidratos</th>
                <th scope="col" className="p-3">Proteínas</th>
                <th scope="col" className="rounded-r-lg p-3">Sódio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="border-b border-slate-100 p-4 text-center text-slate-500">
                  Informação não cadastrada pelo fornecedor
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-wider text-emerald-700">
                {venda_online_ativa ? 'Complete a sua compra' : 'Mais ofertas do catálogo'}
              </p>
              <h2 className="m-0 text-2xl font-black">
                {venda_online_ativa ? 'Quem comprou também levou' : 'Produtos relacionados'}
              </h2>
            </div>
            <Link href="/catalogo" className="hidden text-sm font-bold text-emerald-800 hover:underline sm:block">
              Ver catálogo
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {recommendations.map((recommendedProduct) => (
              <ProductCard key={recommendedProduct.id} product={recommendedProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
