'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChefHat, Check, Clock3, Plus, Store, Users } from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog-types';
import { dailyRecipes, type Recipe } from '@/lib/recipes';
import { useShoppingCart } from './cart-provider';
import { useOnlineSales } from './admin-data-provider';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function findIngredientProduct(
  ingredient: Recipe['ingredients'][number],
  products: CatalogProduct[],
) {
  const terms = ingredient.searchTerms.map(normalize);
  return products.find((product) => {
    if (product.active === false) return false;
    const productName = normalize(product.name);
    return terms.some(
      (term) => productName === term || productName.includes(term),
    );
  });
}

function RecipeCard({
  recipe,
  products,
}: {
  recipe: Recipe;
  products: CatalogProduct[];
}) {
  const { addToCart } = useShoppingCart();
  const { venda_online_ativa } = useOnlineSales();
  const [feedback, setFeedback] = useState('');
  const ingredientMatches = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        ingredient,
        product: findIngredientProduct(ingredient, products),
      })),
    [products, recipe.ingredients],
  );
  const missingIngredients = ingredientMatches.filter(({ product }) => !product);
  const availableIngredients = ingredientMatches.filter(
    (item): item is typeof item & { product: CatalogProduct } =>
      productIsAvailable(item.product),
  );

  function addRecipeIngredients() {
    if (!venda_online_ativa || !availableIngredients.length) return;
    for (const { ingredient, product } of availableIngredients) {
      addToCart(product, ingredient.quantity);
    }
    setFeedback(
      missingIngredients.length
        ? `${availableIngredients.length} ingrediente(s) adicionado(s). Não encontrados no catálogo: ${missingIngredients.map(({ ingredient }) => ingredient.name).join(', ')}.`
        : 'Todos os ingredientes foram adicionados à sacola.',
    );
  }

  const buttonLabel =
    missingIngredients.length && availableIngredients.length
      ? 'Adicionar ingredientes disponíveis'
      : 'Adicionar Todos os Ingredientes ao Carrinho';

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[var(--brand-primary)] to-emerald-950 p-5 text-white sm:p-6">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
          <ChefHat size={23} />
        </span>
        <h2 className="m-0 text-xl font-black">{recipe.name}</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-white/80">
          {recipe.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-white/90">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={15} /> {recipe.time}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> {recipe.servings} porções
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="m-0 text-sm font-black text-slate-900">Ingredientes</h3>
        <ul className="mb-5 mt-3 list-none space-y-2 p-0">
          {ingredientMatches.map(({ ingredient, product }) => (
            <li
              key={ingredient.name}
              className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm"
            >
              <span className="min-w-0">
                {product ? (
                  <Link
                    href={`/produtos/${product.id}`}
                    className="font-semibold text-slate-700 hover:text-emerald-800 hover:underline"
                  >
                    {ingredient.name}
                  </Link>
                ) : (
                  <span className="text-slate-500">{ingredient.name}</span>
                )}
                {!product && (
                  <span className="ml-2 text-xs font-semibold text-amber-700">
                    indisponível no catálogo
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {ingredient.quantity} {ingredient.unit}
              </span>
            </li>
          ))}
        </ul>

        <h3 className="m-0 text-sm font-black text-slate-900">Modo de preparo</h3>
        <ol className="mb-5 mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-slate-600">
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {venda_online_ativa ? (
          <>
            <button
              type="button"
              onClick={addRecipeIngredients}
              disabled={!availableIngredients.length}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {feedback.startsWith('Todos') ? <Check size={17} /> : <Plus size={17} />}
              {buttonLabel}
            </button>
            {feedback && (
              <p role="status" className="mb-0 mt-3 text-xs leading-5 text-slate-600">
                {feedback}
              </p>
            )}
          </>
        ) : (
          <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-600">
            <Store size={16} className="shrink-0 text-emerald-700" />
            <span>Consulte na loja física · Catálogo de ofertas</span>
          </div>
        )}
      </div>
    </article>
  );
}

function productIsAvailable(
  product: CatalogProduct | undefined,
): product is CatalogProduct {
  return Boolean(product);
}

export default function RecipeSuggestions({
  products,
  compact = false,
}: {
  products: CatalogProduct[];
  compact?: boolean;
}) {
  const { venda_online_ativa } = useOnlineSales();

  return (
    <section
      aria-labelledby="daily-recipes-title"
      className={`mx-auto max-w-7xl px-4 lg:px-8 ${compact ? 'pb-12 pt-6' : 'pb-14 pt-8 sm:pt-10'}`}
    >
      {!compact && (
        <header className="mb-8 rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
            <ChefHat size={16} /> Ideias para cozinhar
          </p>
          <h1 id="daily-recipes-title" className="m-0 text-3xl font-black sm:text-4xl">
            Receitas e Sugestões do Dia
          </h1>
          <p className="mb-0 mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">
            {venda_online_ativa
              ? 'Inspire-se com receitas práticas, confira os ingredientes no catálogo e adicione tudo o que estiver disponível à sua sacola.'
              : 'Inspire-se com receitas práticas e confira a disponibilidade dos ingredientes no nosso catálogo de ofertas.'}
          </p>
        </header>
      )}
      {compact && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
              Ideias para hoje
            </p>
            <h2 id="daily-recipes-title" className="m-0 text-2xl font-black text-slate-900">
              Receitas e Sugestões do Dia
            </h2>
          </div>
          <Link href="/receitas" className="text-sm font-bold text-emerald-800 hover:underline">
            Ver todas as receitas
          </Link>
        </div>
      )}
      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        {dailyRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} products={products} />
        ))}
      </div>
    </section>
  );
}
