import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import type { CatalogProduct } from '@/lib/catalog-types';
import { mapProductRows, type ProductRow } from '@/lib/catalog-mapper';

export function resolveOfferEndsAt(dataFim: string): string {
  const trimmed = String(dataFim).trim();
  const isoCandidate = trimmed.includes('T')
    ? trimmed
    : `${trimmed.slice(0, 10)}T23:59:59.999-03:00`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime())
    ? new Date(`${trimmed.slice(0, 10)}T23:59:59.999-03:00`).toISOString()
    : parsed.toISOString();
}

async function queryProducts(activeOnly: boolean): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select(
      'id, nome, descricao, categoria, preco_normal, preco_oferta, imagem_url, unidade, marca, selo, tabloide_pagina, restricoes_json, estoque, ativo',
    )
    .order('nome')
    .returns<ProductRow[]>();

  if (error) {
    throw new Error(`Não foi possível carregar o catálogo: ${error.message}`);
  }

  return mapProductRows(
    activeOnly ? data.filter((product) => product.ativo) : data,
  );
}

export const getCatalogProducts = cache(async (): Promise<CatalogProduct[]> => {
  const products = await queryProducts(true);
  const { data: offers, error } = await supabase
    .from('ofertas_relampago')
    .select('produto_id, preco_promocional, data_inicio, data_fim')
    .order('data_inicio', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar ofertas vigentes: ${error.message}`);
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return products.map((product) => {
    const productOffers = (offers ?? []).filter(
      (offer) => String(offer.produto_id) === product.id,
    );
    const activeOffer = productOffers.find((offer) => {
      const startDay = String(offer.data_inicio).slice(0, 10);
      const endDay = String(offer.data_fim).slice(0, 10);
      return startDay <= today && endDay >= today;
    });
    if (activeOffer) {
      return {
        ...product,
        price: Number(activeOffer.preco_promocional),
        oldPrice: Number(product.oldPrice ?? product.price),
        flashOfferEndsAt: resolveOfferEndsAt(activeOffer.data_fim),
      };
    }
    if (productOffers.length) {
      return { ...product, price: Number(product.oldPrice ?? product.price), oldPrice: null };
    }
    return product;
  });
});

export async function getAdminProducts(): Promise<CatalogProduct[]> {
  return queryProducts(false);
}
