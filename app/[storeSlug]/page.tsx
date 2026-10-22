import { cache } from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Storefront from './storefront';
import { getLocalPageMetadata } from '@/lib/local-seo';

export const instant = false;

interface PageProps {
  params: Promise<{
    storeSlug: string;
  }>;
}

interface Product {
  id: string | number;
  name: string;
  description: string | null;
  price: number | string;
  image_url?: string | null;
  image?: string | null;
}

interface CatalogProduct {
  id: string | number;
  nome: string;
  descricao: string | null;
  preco_normal: number | string;
  preco_oferta: number | string | null;
  imagem_url: string | null;
}

const getStoreBySlug = cache(async (storeSlug: string) => {
  const { data, error } = await supabase
    .from('stores')
    .select('name')
    .eq('slug', storeSlug)
    .maybeSingle();
  if (error) {
    throw new Error(`Não foi possível carregar a loja "${storeSlug}": ${error.message}`);
  }
  return data;
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();
  return getLocalPageMetadata({
    title: `Supermercado ${store.name}`,
    description: `Confira o catálogo, as ofertas de hortifrúti e açougue, e as opções de entrega do ${store.name}.`,
    path: `/${encodeURIComponent(storeSlug)}`,
    storeName: store.name,
  });
}

export default async function StoreHomePage({ params }: PageProps) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const { data: catalogProducts, error: productsError } = await supabase
    .from('produtos')
    .select('id, nome, descricao, preco_normal, preco_oferta, imagem_url')
    .eq('ativo', true)
    .returns<CatalogProduct[]>();

  if (productsError) {
    throw productsError;
  }

  const products: Product[] = catalogProducts.map((product) => ({
    id: product.id,
    name: product.nome,
    description: product.descricao,
    price: product.preco_oferta ?? product.preco_normal,
    image_url: product.imagem_url,
  }));

  return <Storefront storeName={store.name} products={products} />;
}