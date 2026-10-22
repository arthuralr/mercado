'use client';

import {
  Apple,
  Beef,
  Croissant,
  Sparkles,
  ShoppingBasket,
  Wine,
  type LucideIcon,
} from 'lucide-react';

const aisles: Array<{
  name: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { name: 'Açougue', icon: Beef, tone: 'bg-rose-50 text-rose-700' },
  { name: 'Hortifrúti', icon: Apple, tone: 'bg-lime-50 text-lime-700' },
  { name: 'Padaria', icon: Croissant, tone: 'bg-amber-50 text-amber-700' },
  { name: 'Bebidas', icon: Wine, tone: 'bg-sky-50 text-sky-700' },
  { name: 'Limpeza', icon: Sparkles, tone: 'bg-violet-50 text-violet-700' },
  { name: 'Mercearia', icon: ShoppingBasket, tone: 'bg-emerald-50 text-emerald-700' },
];

export default function CategoryShowcase({
  selected,
  counts,
  onSelect,
}: {
  selected: string;
  counts: Record<string, number>;
  onSelect: (category: string) => void;
}) {
  return (
    <section
      aria-labelledby="aisles-title"
      className="mx-auto max-w-7xl px-4 pt-8 lg:px-8"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            Explore a loja
          </p>
          <h2 id="aisles-title" className="m-0 text-xl font-black text-slate-900 sm:text-2xl">
            Corredores de supermercado
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onSelect('')}
          aria-pressed={!selected}
          className={`rounded-full px-3 py-2 text-xs font-bold transition ${
            !selected
              ? 'bg-[var(--brand-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-primary)]'
          }`}
        >
          Ver tudo
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {aisles.map(({ name, icon: Icon, tone }) => {
          const active = selected === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(active ? '' : name)}
              aria-pressed={active}
              className={`group flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition sm:min-h-24 sm:flex-col sm:items-start sm:justify-between sm:p-4 ${
                active
                  ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_7%,white)] shadow-sm'
                  : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={21} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">
                  {name}
                </span>
                <span className="text-xs text-slate-500">
                  {counts[name] ?? 0} produtos
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
