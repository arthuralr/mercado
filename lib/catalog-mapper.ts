import type { CatalogProduct } from '@/lib/catalog-types';

export interface ProductRow {
  id: string | number;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco_normal: number | string;
  preco_oferta: number | string | null;
  imagem_url: string | null;
  unidade: string | null;
  marca: string | null;
  selo: string | null;
  tabloide_pagina: string | null;
  restricoes_json: unknown;
  estoque: number | null;
  ativo: boolean;
}

export function mapProductRows(rows: ProductRow[]): CatalogProduct[] {
  return rows.map((row) => {
    const restrictions = Array.isArray(row.restricoes_json)
      ? row.restricoes_json.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    return {
      id: String(row.id),
      name: row.nome,
      description: row.descricao,
      category: row.categoria ?? 'Outros',
      unit: row.unidade ?? 'unidade',
      price: Number(row.preco_oferta ?? row.preco_normal),
      oldPrice:
        row.preco_oferta === null ? null : Number(row.preco_normal),
      image: row.imagem_url,
      brand: row.marca ?? 'Sem marca',
      restrictions,
      flyerPage: row.tabloide_pagina,
      badge: row.selo,
      stock: row.estoque,
      active: row.ativo,
    };
  });
}
