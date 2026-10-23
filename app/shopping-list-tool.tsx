'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ClipboardCopy,
  ClipboardList,
  Download,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog-types';
import { useManagedProducts, useSiteSettings } from './admin-data-provider';

export interface QuickListItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  price?: number;
  checked: boolean;
}

const STORAGE_KEY = 'supermarket-quick-shopping-list-v1';
const TITLE_STORAGE_KEY = 'supermarket-quick-shopping-list-title-v1';
const OPEN_EVENT = 'open-quick-shopping-list';
const UPDATED_EVENT = 'quick-shopping-list-updated';

const QUICK_SUGGESTIONS = [
  'Arroz 5kg',
  'Feijão 1kg',
  'Leite Integral 1L',
  'Café Torrado e Moído',
  'Óleo de Soja',
  'Açúcar 1kg',
  'Ovos Brancos',
  'Pão de Forma',
  'Manteiga',
  'Detergente',
];

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function openQuickShoppingList() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

function readStoredList(): QuickListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QuickListItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as QuickListItem).id === 'string' &&
        typeof (item as QuickListItem).name === 'string' &&
        typeof (item as QuickListItem).quantity === 'number' &&
        (item as QuickListItem).quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeStoredList(items: QuickListItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
  } catch (error) {
    console.error('Não foi possível salvar a lista de compras no navegador.', error);
  }
}

export function useQuickShoppingListCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      const items = readStoredList();
      setCount(items.reduce((sum, item) => sum + item.quantity, 0));
    };
    sync();
    window.addEventListener(UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return count;
}

export function ShoppingListCalloutBanner() {
  const count = useQuickShoppingListCount();

  return (
    <section
      aria-label="Ferramenta Crie sua Lista de Compras"
      className="mx-auto max-w-7xl px-4 pt-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white shadow-md sm:p-7">
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-2xl">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-xs">
              <Sparkles size={13} />
              Grátis e sem precisar de login
            </span>
            <h2 className="m-0 text-xl font-black tracking-tight sm:text-2xl">
              Crie sua Lista de Compras em segundos
            </h2>
            <p className="mb-0 mt-1.5 text-sm leading-relaxed text-emerald-100">
              Monte sua lista de supermercado, confira preços das ofertas, baixe no celular, copie o texto ou compartilhe direto no WhatsApp com um clique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openQuickShoppingList}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-amber-400 px-5 py-3.5 text-sm font-black text-zinc-950 shadow-lg transition hover:bg-amber-300 active:scale-[0.99]"
            >
              <ClipboardList size={20} />
              <span>Crie sua Lista de Compras</span>
              {count > 0 && (
                <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-black text-amber-300">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function QuickShoppingListModal() {
  const { settings } = useSiteSettings();
  const catalogProducts = useManagedProducts<CatalogProduct>([]);
  const storeName = settings.institution.storeName.trim() || 'Supermercado';

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuickListItem[]>([]);
  const [listTitle, setListTitle] = useState('Minha Lista de Compras');
  const [itemText, setItemText] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setItems(readStoredList());
    const savedTitle = window.localStorage.getItem(TITLE_STORAGE_KEY);
    if (savedTitle) setListTitle(savedTitle);

    const handleOpen = () => {
      setItems(readStoredList());
      setOpen(true);
    };
    const handleSync = () => {
      setItems(readStoredList());
    };
    window.addEventListener(OPEN_EVENT, handleOpen);
    window.addEventListener(UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpen);
      window.removeEventListener(UPDATED_EVENT, handleSync);
    };
  }, []);

  function updateItems(next: QuickListItem[]) {
    setItems(next);
    writeStoredList(next);
  }

  function handleTitleChange(value: string) {
    setListTitle(value);
    try {
      window.localStorage.setItem(TITLE_STORAGE_KEY, value);
    } catch {
      // ignore storage errors
    }
  }

  const matchingCatalogProducts = useMemo(() => {
    const query = itemText.trim().toLocaleLowerCase('pt-BR');
    if (query.length < 2) return [];
    return catalogProducts
      .filter(
        (product) =>
          product.active !== false &&
          `${product.name} ${product.category}`
            .toLocaleLowerCase('pt-BR')
            .includes(query),
      )
      .slice(0, 5);
  }, [catalogProducts, itemText]);

  function addItem(
    rawName: string,
    qty = 1,
    meta?: { unit?: string; price?: number },
  ) {
    const cleanName = rawName.trim();
    if (!cleanName) return;
    const validQty = Math.max(1, Math.round(Number(qty) || 1));

    const existingIndex = items.findIndex(
      (entry) =>
        entry.name.toLocaleLowerCase('pt-BR') ===
        cleanName.toLocaleLowerCase('pt-BR'),
    );

    if (existingIndex >= 0) {
      const next = items.map((entry, idx) =>
        idx === existingIndex
          ? {
              ...entry,
              quantity: entry.quantity + validQty,
              unit: meta?.unit ?? entry.unit,
              price: meta?.price ?? entry.price,
            }
          : entry,
      );
      updateItems(next);
    } else {
      const matchedCatalog =
        meta?.price === undefined
          ? catalogProducts.find(
              (product) =>
                product.active !== false &&
                product.name.toLocaleLowerCase('pt-BR') ===
                  cleanName.toLocaleLowerCase('pt-BR'),
            )
          : undefined;

      const newItem: QuickListItem = {
        id: crypto.randomUUID(),
        name: cleanName,
        quantity: validQty,
        unit: meta?.unit ?? matchedCatalog?.unit,
        price: meta?.price ?? matchedCatalog?.price,
        checked: false,
      };
      updateItems([...items, newItem]);
    }
    setItemText('');
    setItemQty(1);
    setFeedback('');
  }

  function handleAddForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemText.trim()) return;
    const parts = itemText
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      let current = [...items];
      for (const part of parts) {
        const existingIdx = current.findIndex(
          (entry) =>
            entry.name.toLocaleLowerCase('pt-BR') ===
            part.toLocaleLowerCase('pt-BR'),
        );
        if (existingIdx >= 0) {
          current = current.map((entry, idx) =>
            idx === existingIdx
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry,
          );
        } else {
          current.push({
            id: crypto.randomUUID(),
            name: part,
            quantity: 1,
            checked: false,
          });
        }
      }
      updateItems(current);
      setItemText('');
      setItemQty(1);
      return;
    }
    addItem(itemText, itemQty);
  }

  function changeItemQuantity(id: string, delta: number) {
    const next = items
      .map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + delta } : item,
      )
      .filter((item) => item.quantity > 0);
    updateItems(next);
  }

  function toggleItemChecked(id: string) {
    updateItems(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  }

  function removeItem(id: string) {
    updateItems(items.filter((item) => item.id !== id));
  }

  function clearList() {
    updateItems([]);
    setFeedback('Lista limpa.');
  }

  const estimatedTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          typeof item.price === 'number' && Number.isFinite(item.price)
            ? sum + item.price * item.quantity
            : sum,
        0,
      ),
    [items],
  );

  function formatListAsText(): string {
    const title = listTitle.trim() || 'Minha Lista de Compras';
    const lines = [
      `🛒 *${title} — ${storeName}*`,
      '',
      ...items.map((item) => {
        const checkMark = item.checked ? '✅' : '▫️';
        const pricePart =
          typeof item.price === 'number'
            ? ` (${currency.format(item.price * item.quantity)})`
            : '';
        return `${checkMark} ${item.quantity}x ${item.name}${pricePart}`;
      }),
    ];
    if (estimatedTotal > 0) {
      lines.push('', `💰 *Estimativa dos itens com preço:* ${currency.format(estimatedTotal)}`);
    }
    lines.push('', `📍 Lista criada em ${storeName}`);
    return lines.join('\n');
  }

  async function handleCopyList() {
    if (!items.length) {
      setFeedback('Adicione pelo menos um item antes de copiar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatListAsText());
      setFeedback('Lista copiada para a área de transferência!');
    } catch {
      setFeedback('Não foi possível copiar automaticamente. Verifique as permissões do navegador.');
    }
  }

  function handleDownloadList() {
    if (!items.length) {
      setFeedback('Adicione pelo menos um item antes de baixar a lista.');
      return;
    }
    const textContent = formatListAsText().replace(/\*/g, '');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = (listTitle.trim() || 'lista-de-compras')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    link.href = url;
    link.download = `${safeSlug || 'lista-de-compras'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback('Arquivo da lista baixado com sucesso!');
  }

  function handleShareWhatsApp() {
    if (!items.length) {
      setFeedback('Adicione pelo menos um item antes de compartilhar no WhatsApp.');
      return;
    }
    const text = formatListAsText();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Fechar lista de compras"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-shopping-list-title"
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 bg-emerald-950 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-zinc-950">
                <Sparkles size={12} />
                Sem necessidade de login
              </span>
              <h2
                id="quick-shopping-list-title"
                className="m-0 mt-1.5 flex items-center gap-2 text-xl font-black"
              >
                <ClipboardList size={22} className="text-amber-300" />
                Crie sua Lista de Compras
              </h2>
              <p className="mb-0 mt-1 text-xs text-emerald-100">
                Adicione itens, baixe no celular, copie ou envie para o seu WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar ferramenta de lista de compras"
              className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Nome da sua lista
              <input
                type="text"
                value={listTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                maxLength={60}
                placeholder="Ex.: Compras da Semana, Churrasco..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-700 focus:bg-white"
              />
            </label>
          </div>

          <form onSubmit={handleAddForm} className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Adicionar item à lista
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={itemText}
                  onChange={(event) => setItemText(event.target.value)}
                  placeholder="Digite um produto (ex.: Arroz, Leite, Maçã)..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-700"
                />
              </div>
              <input
                type="number"
                min={1}
                max={99}
                value={itemQty}
                onChange={(event) => setItemQty(Number(event.target.value) || 1)}
                aria-label="Quantidade"
                className="w-16 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-center text-sm font-bold outline-none focus:border-emerald-700"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <Plus size={17} />
                Adicionar
              </button>
            </div>

            {matchingCatalogProducts.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2">
                <p className="mb-1.5 mt-0 px-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Sugestões do catálogo com preço da loja:
                </p>
                <div className="space-y-1">
                  {matchingCatalogProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        addItem(product.name, itemQty, {
                          unit: product.unit,
                          price: product.price,
                        })
                      }
                      className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-emerald-100"
                    >
                      <span className="truncate">{product.name}</span>
                      <span className="ml-2 shrink-0 font-black text-emerald-800">
                        {currency.format(product.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          <div>
            <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-slate-500">
              Adição rápida de essenciais:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addItem(suggestion, 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Plus size={12} className="text-emerald-700" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-sm font-black text-slate-900">
                Itens na sua lista ({items.reduce((sum, i) => sum + i.quantity, 0)})
              </h3>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearList}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Limpar lista
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <ClipboardList size={28} className="mx-auto text-slate-400" />
                <p className="mb-0 mt-2 text-sm font-bold text-slate-700">
                  Sua lista de compras está vazia
                </p>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Digite os produtos acima ou toque nos botões de adição rápida para montar sua lista.
                </p>
              </div>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
                      item.checked
                        ? 'border-emerald-200 bg-emerald-50/50 text-slate-500'
                        : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItemChecked(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      aria-pressed={item.checked}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          item.checked
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {item.checked && <Check size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-bold ${
                            item.checked ? 'line-through' : ''
                          }`}
                        >
                          {item.name}
                        </span>
                        {typeof item.price === 'number' && (
                          <span className="text-xs font-semibold text-emerald-800">
                            {currency.format(item.price * item.quantity)}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeItemQuantity(item.id, -1)}
                        aria-label={`Diminuir quantidade de ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-6 text-center text-xs font-black">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeItemQuantity(item.id, 1)}
                        aria-label={`Aumentar quantidade de ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remover ${item.name} da lista`}
                        className="ml-1 rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {estimatedTotal > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-950">
                <span>Estimativa dos produtos do catálogo:</span>
                <span className="text-sm font-black text-emerald-800">
                  {currency.format(estimatedTotal)}
                </span>
              </div>
            )}
          </div>

          {feedback && (
            <p
              role="status"
              className="m-0 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-900"
            >
              {feedback}
            </p>
          )}
        </div>

        <div className="space-y-2.5 border-t border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-95"
          >
            <MessageCircle size={18} />
            Compartilhar Lista no WhatsApp
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleCopyList()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
            >
              <ClipboardCopy size={16} className="text-emerald-700" />
              Copiar Texto
            </button>
            <button
              type="button"
              onClick={handleDownloadList}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <Download size={16} />
              Baixar / Exportar (.txt)
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
