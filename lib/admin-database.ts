'use client';

import { supabaseBrowser } from '@/lib/supabase-browser';
import type { AdminFlyer, AdminOffer } from '@/app/admin-data-provider';
import { mapProductRows, type ProductRow } from '@/lib/catalog-mapper';
import type { CatalogProduct } from '@/lib/catalog-types';
import { currentStoreDate } from '@/lib/site-settings';

function throwIfError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export async function fetchAdminProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await supabaseBrowser
    .from('produtos')
    .select(
      'id, nome, descricao, categoria, preco_normal, preco_oferta, imagem_url, unidade, marca, selo, tabloide_pagina, restricoes_json, estoque, ativo',
    )
    .order('nome')
    .returns<ProductRow[]>();
  throwIfError(error, 'Não foi possível carregar os produtos');
  return mapProductRows(data ?? []);
}

export async function fetchAdminOffers(): Promise<AdminOffer[]> {
  const { data, error } = await supabaseBrowser
    .from('ofertas_relampago')
    .select('id, produto_id, preco_promocional, data_inicio, data_fim')
    .order('data_inicio', { ascending: false });
  throwIfError(error, 'Não foi possível carregar ofertas');

  const offers: AdminOffer[] = [];
  for (const row of data ?? []) {
    const { data: product, error: productError } = await supabaseBrowser
      .from('produtos')
      .select('preco_normal')
      .eq('id', row.produto_id)
      .maybeSingle();
    throwIfError(productError, 'Não foi possível carregar o preço normal da oferta');
    if (!product) continue;
    offers.push({
      id: String(row.id),
      productId: String(row.produto_id),
      normalPrice: Number(product.preco_normal),
      promoPrice: Number(row.preco_promocional),
      startsAt: row.data_inicio,
      endsAt: row.data_fim,
    });
  }
  return offers;
}

export async function persistProduct(
  id: string,
  patch: { active?: boolean; stock?: number | null; normalPrice?: number },
) {
  const values: Record<string, string | number | boolean | null> = {};
  if (patch.active !== undefined) values.ativo = patch.active;
  if (Object.hasOwn(patch, 'stock')) values.estoque = patch.stock ?? null;
  if (patch.normalPrice !== undefined) {
    values.preco_normal = patch.normalPrice;
    values.preco_oferta = null;
  }
  const { data, error } = await supabaseBrowser
    .from('produtos')
    .update(values)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  throwIfError(error, 'Não foi possível salvar o produto');
  if (!data) throw new Error('Produto não encontrado ou não autorizado para alteração.');
}

export async function persistOffer(offer: AdminOffer) {
  const { error } = await supabaseBrowser.rpc('salvar_oferta', {
    p_id: offer.id || null,
    p_produto_id: offer.productId,
    p_preco_normal: offer.normalPrice,
    p_preco_promocional: offer.promoPrice,
    p_data_inicio: offer.startsAt,
    p_data_fim: offer.endsAt,
  });
  throwIfError(error, 'Não foi possível salvar a oferta');
}

export async function removeOffer(id: string) {
  const { error } = await supabaseBrowser.rpc('remover_oferta', {
    p_id: id,
  });
  throwIfError(error, 'Não foi possível remover a oferta');
}

export async function fetchFlyer(): Promise<AdminFlyer | null> {
  const { data, error } = await supabaseBrowser
    .from('encartes')
    .select('titulo, validade, arquivo_url, arquivo_nome')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, 'Não foi possível carregar o encarte');
  return data
    ? {
        title: data.titulo,
        validUntil: data.validade,
        fileName: data.arquivo_nome,
        fileType: '',
        fileSize: 0,
        fileUrl: data.arquivo_url,
      }
    : null;
}

export async function persistFlyer(
  flyer: AdminFlyer,
  file?: File,
) {
  let fileUrl = flyer.fileUrl;
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${Date.now()}-${safeName}`;
    const { data: uploaded, error: uploadError } =
      await supabaseBrowser.storage.from('encartes').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
    throwIfError(uploadError, 'Não foi possível enviar o encarte');
    if (!uploaded) {
      throw new Error('O Storage não retornou o arquivo enviado.');
    }
    fileUrl = supabaseBrowser.storage.from('encartes').getPublicUrl(uploaded.path)
      .data.publicUrl;
  }
  if (!fileUrl) throw new Error('Escolha um arquivo de encarte.');

  const { data: existing, error: selectError } = await supabaseBrowser
    .from('encartes')
    .select('id')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(selectError, 'Não foi possível verificar o encarte atual');

  const values = {
    titulo: flyer.title,
    validade: flyer.validUntil,
    arquivo_url: fileUrl,
    arquivo_nome: file?.name ?? flyer.fileName,
    atualizado_em: new Date().toISOString(),
  };
  const result = existing
    ? await supabaseBrowser.from('encartes').update(values).eq('id', existing.id)
    : await supabaseBrowser.from('encartes').insert(values);
  throwIfError(result.error, 'Não foi possível salvar os dados do encarte');
  return { ...flyer, fileUrl, fileName: values.arquivo_nome };
}

export async function fetchTodayOrderCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabaseBrowser
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .gte('criado_em', start.toISOString());
  throwIfError(error, 'Não foi possível carregar os pedidos de hoje');
  return count ?? 0;
}

export async function fetchTodayMetrics(): Promise<{ visits: number; flyerViews: number }> {
  const today = currentStoreDate();
  const [visits, flyerViews] = await Promise.all([
    supabaseBrowser.from('metricas_visita').select('id', { count: 'exact', head: true }).eq('tipo', 'visit').eq('data_evento', today),
    supabaseBrowser.from('metricas_visita').select('id', { count: 'exact', head: true }).eq('tipo', 'flyer_view').eq('data_evento', today),
  ]);
  throwIfError(visits.error, 'Não foi possível consultar as visitas de hoje');
  throwIfError(flyerViews.error, 'Não foi possível consultar as visualizações do encarte');
  return { visits: visits.count ?? 0, flyerViews: flyerViews.count ?? 0 };
}

export async function importProductPrices(
  rows: Array<{ id: string; preco_normal: number; estoque?: number | null }>,
): Promise<number> {
  const { data, error } = await supabaseBrowser.rpc('importar_precos', {
    p_linhas: rows,
  });
  throwIfError(error, 'Não foi possível importar os preços');
  return Number(data);
}
