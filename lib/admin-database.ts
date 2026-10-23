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

export const STANDARD_PRODUCT_CATEGORIES = [
  'Hortifrúti',
  'Açougue',
  'Padaria',
  'Bebidas',
  'Frios e Laticínios',
  'Mercearia',
  'Limpeza',
  'Higiene e Perfumaria',
  'Congelados',
  'Bazar e Casa',
  'Pet Shop',
  'Doces e Sobremesas',
  'Outros',
] as const;

export const STANDARD_PRODUCT_UNITS = [
  'unidade',
  'kg',
  'g',
  'litro',
  'ml',
  'pacote',
  'caixa',
  'bandeja',
  'lata',
  'garrafa',
  'pote',
] as const;

export interface PriceImportRow {
  id: string;
  preco_normal: number;
  estoque: number | null;
}

export const FLYER_SECTION_OPTIONS = [
  { id: 'capa', label: 'Destaques da semana (Capa)' },
  { id: 'hortifruti', label: 'Feirinha fresquinha (Hortifrúti)' },
  { id: 'acougue-bebidas', label: 'Açougue e bebidas' },
  { id: 'mercearia-limpeza', label: 'Mercearia e casa' },
] as const;

export type FlyerSectionId = (typeof FLYER_SECTION_OPTIONS)[number]['id'];

const VALID_FLYER_SECTION_IDS = new Set<string>(
  FLYER_SECTION_OPTIONS.map((option) => option.id),
);

export function isValidFlyerSectionId(value: string): value is FlyerSectionId {
  return VALID_FLYER_SECTION_IDS.has(value);
}

export interface ProductPatch {
  active?: boolean;
  stock?: number | null;
  normalPrice?: number;
  offerPrice?: number | null;
  flyerPage?: string | null;
  badge?: string | null;
  name?: string;
  category?: string;
  unit?: string;
  brand?: string | null;
  image?: string | null;
  description?: string | null;
}

export interface NewAdminProductInput {
  id?: string;
  name: string;
  category: string;
  unit?: string;
  brand?: string | null;
  normalPrice: number;
  offerPrice?: number | null;
  stock?: number | null;
  flyerPage?: string | null;
  badge?: string | null;
  image?: string | null;
  description?: string | null;
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

  const rows = data ?? [];
  if (!rows.length) return [];

  const productIds = [...new Set(rows.map((row) => String(row.produto_id)))];
  const { data: products, error: productError } = await supabaseBrowser
    .from('produtos')
    .select('id, preco_normal')
    .in('id', productIds);
  throwIfError(productError, 'Não foi possível carregar o preço normal da oferta');

  const normalPriceById = new Map(
    (products ?? []).map((product) => [
      String(product.id),
      Number(product.preco_normal),
    ]),
  );

  return rows.map((row) => {
    const productId = String(row.produto_id);
    const promoPrice = Number(row.preco_promocional);
    const normalPrice = normalPriceById.get(productId) ?? promoPrice;
    return {
      id: String(row.id),
      productId,
      normalPrice,
      promoPrice,
      startsAt: String(row.data_inicio).slice(0, 10),
      endsAt: String(row.data_fim).slice(0, 10),
    };
  });
}

export async function fetchActiveOffersCount(): Promise<number> {
  const today = currentStoreDate();
  const { data, count, error } = await supabaseBrowser
    .from('ofertas_relampago')
    .select('id', { count: 'exact' })
    .lte('data_inicio', today)
    .gte('data_fim', today);
  throwIfError(error, 'Não foi possível consultar as ofertas ativas de hoje');
  return count ?? data?.length ?? 0;
}

export async function persistProduct(
  id: string,
  patch: ProductPatch,
) {
  const cleanId = String(id ?? '').trim();
  if (!cleanId) {
    throw new Error('ID do produto inválido.');
  }

  const values: Record<string, string | number | boolean | null> = {};
  if (patch.active !== undefined) values.ativo = Boolean(patch.active);
  if (Object.hasOwn(patch, 'stock')) {
    if (patch.stock !== null && patch.stock !== undefined) {
      const stockNum = Number(patch.stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        throw new Error('O estoque deve ser um número inteiro não negativo.');
      }
      values.estoque = stockNum;
    } else {
      values.estoque = null;
    }
  }
  if (patch.normalPrice !== undefined) {
    const normalPriceNum = Number(patch.normalPrice);
    if (!Number.isFinite(normalPriceNum) || normalPriceNum < 0) {
      throw new Error('Informe um preço normal válido.');
    }
    values.preco_normal = Number(normalPriceNum.toFixed(2));
    if (!Object.hasOwn(patch, 'offerPrice')) {
      values.preco_oferta = null;
    }
  }
  if (Object.hasOwn(patch, 'offerPrice')) {
    if (patch.offerPrice === null || patch.offerPrice === undefined) {
      values.preco_oferta = null;
    } else {
      const offerPriceNum = Number(patch.offerPrice);
      if (!Number.isFinite(offerPriceNum) || offerPriceNum <= 0) {
        throw new Error('O preço promocional do encarte deve ser maior que zero.');
      }
      if (
        patch.normalPrice !== undefined &&
        offerPriceNum >= Number(patch.normalPrice)
      ) {
        throw new Error(
          'O preço promocional do encarte deve ser menor que o preço normal.',
        );
      }
      values.preco_oferta = Number(offerPriceNum.toFixed(2));
    }
  }
  if (Object.hasOwn(patch, 'flyerPage')) {
    const rawPage = patch.flyerPage?.trim() ?? '';
    if (rawPage && !isValidFlyerSectionId(rawPage)) {
      throw new Error('Seção do panfleto inválida.');
    }
    values.tabloide_pagina = rawPage || null;
  }
  if (Object.hasOwn(patch, 'badge')) {
    const rawBadge = patch.badge?.trim() ?? '';
    values.selo = rawBadge ? rawBadge.slice(0, 60) : null;
  }
  if (patch.name !== undefined) {
    const cleanName = patch.name.trim();
    if (!cleanName) throw new Error('Informe o nome do produto.');
    values.nome = cleanName;
  }
  if (patch.category !== undefined) {
    values.categoria = patch.category.trim() || 'Outros';
  }
  if (patch.unit !== undefined) {
    values.unidade = patch.unit.trim() || 'unidade';
  }
  if (patch.brand !== undefined) {
    values.marca = patch.brand?.trim() || null;
  }
  if (Object.hasOwn(patch, 'image')) {
    values.imagem_url = patch.image?.trim() || null;
  }
  if (Object.hasOwn(patch, 'description')) {
    values.descricao = patch.description?.trim() || null;
  }

  const { data, error } = await supabaseBrowser
    .from('produtos')
    .update(values)
    .eq('id', cleanId)
    .select(
      'id, nome, descricao, categoria, preco_normal, preco_oferta, imagem_url, unidade, marca, selo, tabloide_pagina, restricoes_json, estoque, ativo',
    )
    .returns<ProductRow[]>()
    .maybeSingle();
  throwIfError(error, 'Não foi possível salvar o produto');
  if (!data) throw new Error('Produto não encontrado ou não autorizado para alteração.');
  return mapProductRows([data])[0];
}

export async function createAdminProduct(
  input: NewAdminProductInput,
): Promise<CatalogProduct> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Informe o nome do produto.');
  }
  const normalPrice = Number(input.normalPrice);
  if (!Number.isFinite(normalPrice) || normalPrice <= 0) {
    throw new Error('Informe um preço normal maior que zero.');
  }
  let offerPrice: number | null = null;
  if (input.offerPrice !== null && input.offerPrice !== undefined) {
    const parsedOffer = Number(input.offerPrice);
    if (!Number.isFinite(parsedOffer) || parsedOffer <= 0) {
      throw new Error('O preço promocional do encarte deve ser maior que zero.');
    }
    if (parsedOffer >= normalPrice) {
      throw new Error('O preço promocional do encarte deve ser menor que o preço normal.');
    }
    offerPrice = Number(parsedOffer.toFixed(2));
  }
  const rawPage = input.flyerPage?.trim() ?? '';
  if (rawPage && !isValidFlyerSectionId(rawPage)) {
    throw new Error('Seção do panfleto inválida.');
  }
  const stock =
    input.stock === null || input.stock === undefined
      ? null
      : Number(input.stock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    throw new Error('O estoque deve ser um número inteiro não negativo.');
  }

  const slugBase = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const customId = input.id?.trim();
  const id = customId || `prod-${slugBase || 'item'}-${Date.now().toString(36)}`;

  const values = {
    id,
    nome: name,
    categoria: input.category.trim() || 'Mercearia',
    unidade: input.unit?.trim() || 'unidade',
    marca: input.brand?.trim() || null,
    preco_normal: Number(normalPrice.toFixed(2)),
    preco_oferta: offerPrice,
    estoque: stock,
    tabloide_pagina: rawPage || null,
    selo: input.badge?.trim() ? input.badge.trim().slice(0, 60) : null,
    imagem_url: input.image?.trim() || null,
    descricao: input.description?.trim() || null,
    ativo: true,
  };

  const { data, error } = await supabaseBrowser
    .from('produtos')
    .insert(values)
    .select(
      'id, nome, descricao, categoria, preco_normal, preco_oferta, imagem_url, unidade, marca, selo, tabloide_pagina, restricoes_json, estoque, ativo',
    )
    .returns<ProductRow[]>()
    .single();
  throwIfError(error, 'Não foi possível cadastrar o produto');
  if (!data) {
    throw new Error('O produto não pôde ser cadastrado.');
  }
  return mapProductRows([data])[0];
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Formato inválido. Use imagem JPG, PNG ou WebP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `produtos/prod-${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabaseBrowser.storage
    .from('encartes')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  }
  if (!data?.path) {
    throw new Error('O Supabase Storage não retornou o caminho do arquivo.');
  }
  const publicUrl = supabaseBrowser.storage
    .from('encartes')
    .getPublicUrl(data.path).data.publicUrl;
  if (!publicUrl) {
    throw new Error('Não foi possível obter o endereço público da imagem.');
  }
  return publicUrl;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  const cleanId = String(id ?? '').trim();
  if (!cleanId) throw new Error('ID do produto inválido.');
  await supabaseBrowser.from('ofertas_relampago').delete().eq('produto_id', cleanId);
  const { error } = await supabaseBrowser
    .from('produtos')
    .delete()
    .eq('id', cleanId);
  throwIfError(error, 'Não foi possível excluir o produto');
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
    id: String(row.id),
    title: String(row.titulo ?? ''),
    validUntil: String(row.validade ?? '').slice(0, 10),
    fileName: String(row.arquivo_nome ?? ''),
    fileType: getFlyerMimeType(String(row.arquivo_nome ?? '')),
    fileSize: 0,
    fileUrl: row.arquivo_url ? String(row.arquivo_url) : undefined,
  }));
}

export async function persistFlyer(
  flyer: AdminFlyer,
  file?: File,
) {
  const cleanTitle = flyer.title.trim();
  const cleanValidUntil = flyer.validUntil.trim().slice(0, 10);
  if (!cleanTitle || !/^\d{4}-\d{2}-\d{2}$/.test(cleanValidUntil)) {
    throw new Error('Informe o título e uma data de validade válida para o encarte.');
  }

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
    titulo: cleanTitle,
    validade: cleanValidUntil,
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
    id: String(result.data.id),
    title: values.titulo,
    validUntil: values.validade,
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
  const { data, count, error } = await supabaseBrowser
    .from('pedidos')
    .select('id', { count: 'exact' })
    .gte('criado_em', start)
    .lt('criado_em', end);
  throwIfError(error, 'Não foi possível carregar os pedidos de hoje');
  return count ?? data?.length ?? 0;
}

export async function fetchTodayMetrics(): Promise<{ visits: number; flyerViews: number }> {
  const today = currentStoreDate();
  const [visits, flyerViews] = await Promise.all([
    supabaseBrowser
      .from('metricas_visita')
      .select('id', { count: 'exact' })
      .eq('tipo', 'visit')
      .eq('data_evento', today),
    supabaseBrowser
      .from('metricas_visita')
      .select('id', { count: 'exact' })
      .eq('tipo', 'flyer_view')
      .eq('data_evento', today),
  ]);
  throwIfError(visits.error, 'Não foi possível consultar as visitas de hoje');
  throwIfError(flyerViews.error, 'Não foi possível consultar as visualizações do encarte');
  return {
    visits: visits.count ?? visits.data?.length ?? 0,
    flyerViews: flyerViews.count ?? flyerViews.data?.length ?? 0,
  };
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
