'use client';

import { supabaseBrowser } from '@/lib/supabase-browser';
import type { AdminFlyer, AdminOffer } from '@/app/admin-data-provider';
import { mapProductRows, type ProductRow } from '@/lib/catalog-mapper';
import type { CatalogProduct } from '@/lib/catalog-types';
import { currentStoreDate } from '@/lib/site-settings';
import { isMissingRelationError } from '@/lib/supabase-errors';
import {
  getFlyerMimeType,
  isSupportedFlyerFile,
  MAX_FLYER_FILE_SIZE,
} from '@/lib/flyer-file';

export interface PriceImportRow {
  id: string;
  preco_normal: number;
  estoque: number | null;
}

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

export async function fetchFlyers(): Promise<AdminFlyer[]> {
  const { data, error } = await supabaseBrowser
    .from('encartes')
    .select('id, titulo, validade, arquivo_url, arquivo_nome')
    .order('atualizado_em', { ascending: false });
  if (isMissingRelationError(error)) return [];
  throwIfError(error, 'Não foi possível carregar o encarte');
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.titulo,
    validUntil: row.validade,
    fileName: row.arquivo_nome,
    fileType: getFlyerMimeType(row.arquivo_nome),
    fileSize: 0,
    fileUrl: row.arquivo_url,
  }));
}

export async function persistFlyer(
  flyer: AdminFlyer,
  file?: File,
) {
  let fileUrl = flyer.fileUrl;
  if (file) {
    if (!isSupportedFlyerFile(file)) {
      throw new Error('Formato não suportado. Escolha um arquivo PDF, JPG, PNG ou WebP.');
    }
    if (file.size > MAX_FLYER_FILE_SIZE) {
      throw new Error('O arquivo precisa ter no máximo 10 MB.');
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${Date.now()}-${safeName}`;
    const { data: uploaded, error: uploadError } =
      await supabaseBrowser.storage.from('encartes').upload(path, file, {
        upsert: true,
        contentType: getFlyerMimeType(file.name),
      });
    throwIfError(uploadError, 'Não foi possível enviar o encarte');
    if (!uploaded) {
      throw new Error('O Storage não retornou o arquivo enviado.');
    }
    fileUrl = supabaseBrowser.storage.from('encartes').getPublicUrl(uploaded.path)
      .data.publicUrl;
  }
  if (!fileUrl) throw new Error('Escolha um arquivo de encarte.');

  const values = {
    titulo: flyer.title,
    validade: flyer.validUntil,
    arquivo_url: fileUrl,
    arquivo_nome: file?.name ?? flyer.fileName,
    atualizado_em: new Date().toISOString(),
  };
  const result = flyer.id
    ? await supabaseBrowser
        .from('encartes')
        .update(values)
        .eq('id', flyer.id)
        .select('id')
        .maybeSingle()
    : await supabaseBrowser
        .from('encartes')
        .insert(values)
        .select('id')
        .single();
  throwIfError(result.error, 'Não foi possível salvar os dados do encarte');
  if (!result.data) {
    throw new Error('Encarte não encontrado ou não autorizado para alteração.');
  }
  return {
    ...flyer,
    id: result.data.id,
    fileUrl,
    fileName: values.arquivo_nome,
    fileType: file
      ? getFlyerMimeType(file.name)
      : getFlyerMimeType(values.arquivo_nome),
  };
}

export async function deleteFlyer(id: string): Promise<void> {
  const { data: flyer, error: selectError } = await supabaseBrowser
    .from('encartes')
    .select('arquivo_url')
    .eq('id', id)
    .maybeSingle();
  throwIfError(selectError, 'Não foi possível carregar o encarte para exclusão');
  if (!flyer) throw new Error('Encarte não encontrado ou não autorizado para exclusão.');

  const storagePathMarker = '/storage/v1/object/public/encartes/';
  const storagePathStart = flyer.arquivo_url.indexOf(storagePathMarker);
  if (storagePathStart >= 0) {
    const storagePath = decodeURIComponent(
      flyer.arquivo_url.slice(storagePathStart + storagePathMarker.length),
    );
    const { error: storageError } = await supabaseBrowser.storage
      .from('encartes')
      .remove([storagePath]);
    throwIfError(storageError, 'Não foi possível excluir o arquivo do encarte');
  }

  const { data, error } = await supabaseBrowser
    .from('encartes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  throwIfError(error, 'Não foi possível excluir o encarte');
  if (!data) throw new Error('Encarte não encontrado ou não autorizado para exclusão.');
}

export async function fetchTodayOrderCount(): Promise<number> {
  const today = currentStoreDate();
  const [year, month, day] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  const start = new Date(`${today}T00:00:00-03:00`).toISOString();
  const end = new Date(`${tomorrow}T00:00:00-03:00`).toISOString();
  const { count, error } = await supabaseBrowser
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .gte('criado_em', start)
    .lt('criado_em', end);
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
  const payload: PriceImportRow[] = rows.map((row, index) => {
    const id = String(row.id ?? '').trim();
    const precoNormal = Number(row.preco_normal);
    const hasStock =
      row.estoque !== undefined &&
      row.estoque !== null &&
      String(row.estoque).trim() !== '';
    const estoque = hasStock ? Number(row.estoque) : null;

    if (
      !id ||
      !Number.isFinite(precoNormal) ||
      precoNormal < 0 ||
      (estoque !== null && (!Number.isInteger(estoque) || estoque < 0))
    ) {
      throw new Error(
        `Dados inválidos na linha ${index + 1} ao preparar envio para o Supabase.`,
      );
    }

    return {
      id,
      preco_normal: Number(precoNormal.toFixed(2)),
      estoque,
    };
  });

  const { data, error } = await supabaseBrowser.rpc('importar_precos', {
    p_linhas: payload,
  });
  throwIfError(error, 'Não foi possível importar os preços');

  const ids = payload.map((item) => item.id);
  const { data: existingRows, error: checkError } = await supabaseBrowser
    .from('produtos')
    .select('id, preco_normal, preco_oferta, estoque')
    .in('id', ids);
  throwIfError(checkError, 'Não foi possível confirmar os produtos importados');

  const existingById = new Map(
    (existingRows ?? []).map((item) => [String(item.id), item]),
  );

  const missingIds = ids.filter((id) => !existingById.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `Produto(s) não encontrado(s) no catálogo: ${missingIds.slice(0, 5).join(', ')}`,
    );
  }

  for (const item of payload) {
    const current = existingById.get(item.id);
    const currentPrice = Number(current?.preco_normal);
    const currentStock =
      current?.estoque === null || current?.estoque === undefined
        ? null
        : Number(current.estoque);
    const needsPriceUpdate =
      !Number.isFinite(currentPrice) ||
      Math.abs(currentPrice - item.preco_normal) > 0.001 ||
      current?.preco_oferta !== null;
    const needsStockUpdate =
      item.estoque !== null && currentStock !== item.estoque;

    if (needsPriceUpdate || needsStockUpdate) {
      const updatePatch: {
        preco_normal: number;
        preco_oferta: null;
        estoque?: number;
      } = {
        preco_normal: item.preco_normal,
        preco_oferta: null,
      };
      if (item.estoque !== null) {
        updatePatch.estoque = item.estoque;
      }
      const { data: updated, error: updateError } = await supabaseBrowser
        .from('produtos')
        .update(updatePatch)
        .eq('id', item.id)
        .select('id')
        .maybeSingle();
      throwIfError(
        updateError,
        `Não foi possível atualizar o produto "${item.id}"`,
      );
      if (!updated) {
        throw new Error(
          `O produto "${item.id}" não pôde ser atualizado (verifique permissões de gestor).`,
        );
      }
    }
  }

  const rpcCount = Number(data);
  return Number.isFinite(rpcCount) && rpcCount > 0 ? rpcCount : payload.length;
}
