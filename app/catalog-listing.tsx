'use client';

import { useMemo, useState } from 'react';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from './shop-components';
import { useManagedProducts } from './admin-data-provider';
import type { CatalogProduct } from '@/lib/catalog-types';

const priceRanges = [
  { label: 'Até R$ 10', min: 0, max: 10 },
  { label: 'R$ 10 a R$ 25', min: 10, max: 25 },
  { label: 'R$ 25 a R$ 50', min: 25, max: 50 },
  { label: 'Acima de R$ 50', min: 50, max: Number.POSITIVE_INFINITY },
];

const restrictions = [
  'Sem Glúten',
  'Zero Lactose',
  'Vegano',
  'Orgânico',
  'Sem Açúcar',
  'Integral',
];

export default function CatalogListing({
  products,
  initialDepartment = '',
  initialSearch = '',
}: {
  products: CatalogProduct[];
  initialDepartment?: string;
  initialSearch?: string;
}) {
  const managedProducts = useManagedProducts(products);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialDepartment ? [initialDepartment] : [],
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState('');
  const [sortOrder, setSortOrder] = useState('relevance');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(
    () => [...new Set(managedProducts.filter((product) => product.active !== false).map((product) => product.category))].sort(),
    [managedProducts],
  );
  const brands = useMemo(
    () => [...new Set(managedProducts.filter((product) => product.active !== false).map((product) => product.brand))].sort(),
    [managedProducts],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = initialSearch.trim().toLocaleLowerCase('pt-BR');
    const selectedRange = priceRanges.find(
      (range) => range.label === selectedPriceRange,
    );
    const result = managedProducts.filter((product) => {
      if (product.active === false) return false;
      const matchesSearch =
        !normalizedSearch ||
        `${product.name} ${product.brand} ${product.category}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedSearch);
      const matchesCategory =
        !selectedCategories.length ||
        selectedCategories.includes(product.category);
      const matchesBrand =
        !selectedBrands.length || selectedBrands.includes(product.brand);
      const matchesRestrictions = selectedRestrictions.every((restriction) =>
        product.restrictions.includes(restriction),
      );
      const matchesPrice =
        !selectedRange ||
        (product.price >= selectedRange.min && product.price < selectedRange.max);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesRestrictions &&
        matchesPrice
      );
    });

    if (sortOrder === 'price-asc') {
      return result.sort((a, b) => a.price - b.price);
    }
    if (sortOrder === 'price-desc') {
      return result.sort((a, b) => b.price - a.price);
    }
    return result;
  }, [
    initialSearch,
    managedProducts,
    selectedBrands,
    selectedCategories,
    selectedPriceRange,
    selectedRestrictions,
    sortOrder,
  ]);

  function toggleSelection(
    current: string[],
    setCurrent: (items: string[]) => void,
    item: string,
  ) {
    setCurrent(
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  }

  function resetFilters() {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedRestrictions([]);
    setSelectedPriceRange('');
    setSortOrder('relevance');
  }

  const filterPanel = (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="m-0 flex items-center gap-2 font-black">
          <Filter size={18} className="text-emerald-800" />
          Filtrar produtos
        </h2>
        <button type="button" onClick={resetFilters} className="text-xs font-semibold text-emerald-800 underline">
          Limpar
        </button>
      </div>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="mb-3 text-sm font-bold">Categoria</legend>
        {categories.map((category) => (
          <label key={category} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={selectedCategories.includes(category)}
              onChange={() =>
                toggleSelection(selectedCategories, setSelectedCategories, category)
              }
              className="h-4 w-4 accent-emerald-700"
            />
            {category}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="mb-3 text-sm font-bold">Faixa de preço</legend>
        {priceRanges.map((range) => (
          <label key={range.label} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              name="price-range"
              checked={selectedPriceRange === range.label}
              onChange={() => setSelectedPriceRange(range.label)}
              className="h-4 w-4 accent-emerald-700"
            />
            {range.label}
          </label>
        ))}
        {selectedPriceRange && (
          <button type="button" onClick={() => setSelectedPriceRange('')} className="text-xs text-emerald-800 underline">
            Remover faixa de preço
          </button>
        )}
      </fieldset>

      <fieldset className="max-h-48 space-y-2 overflow-y-auto border-0 p-0">
        <legend className="mb-3 text-sm font-bold">Marcas</legend>
        {brands.map((brand) => (
          <label key={brand} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={selectedBrands.includes(brand)}
              onChange={() => toggleSelection(selectedBrands, setSelectedBrands, brand)}
              className="h-4 w-4 accent-emerald-700"
            />
            {brand}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="mb-3 text-sm font-bold">Restrições alimentares</legend>
        {restrictions.map((restriction) => (
          <label key={restriction} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={selectedRestrictions.includes(restriction)}
              onChange={() =>
                toggleSelection(
                  selectedRestrictions,
                  setSelectedRestrictions,
                  restriction,
                )
              }
              className="h-4 w-4 accent-emerald-700"
            />
            {restriction}
          </label>
        ))}
      </fieldset>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden lg:block">{filterPanel}</aside>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-slate-600">
            <strong className="text-slate-900">{filteredProducts.length}</strong>{' '}
            {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </p>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold lg:hidden"
            >
              <SlidersHorizontal size={17} />
              Filtros
            </button>
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-initial">
              <span className="whitespace-nowrap text-xs text-slate-500">Ordenar:</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none sm:w-40"
                aria-label="Ordenar produtos"
              >
                <option value="relevance">Relevância</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </label>
          </div>
        </div>

        {filteredProducts.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="m-0 font-bold">Nenhum produto encontrado com esses filtros.</p>
            <button type="button" onClick={resetFilters} className="mt-3 text-sm font-bold text-emerald-800 underline">
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <button type="button" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-slate-950/50" />
          <aside className="relative h-full w-full max-w-sm overflow-y-auto bg-[#f7f8f4] p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-black">Filtros</span>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros" className="rounded-full bg-white p-2">
                <X size={18} />
              </button>
            </div>
            {filterPanel}
            <button type="button" onClick={() => setFiltersOpen(false)} className="mt-4 w-full rounded-xl bg-emerald-800 py-3 font-bold text-white">
              Ver {filteredProducts.length} produtos
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
