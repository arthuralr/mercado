'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ClipboardList,
  Copy,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useShoppingCart } from './cart-provider';
import type { CartItem } from '@/lib/catalog-types';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useSiteSettings } from './admin-data-provider';
import { isSafeWebUrl } from '@/lib/site-settings';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const recurringListsStorageKey = 'verdevale-recurring-lists-v1';
const configuredMinimum = Number(
  process.env.NEXT_PUBLIC_MINIMUM_DELIVERY_ORDER ?? 50,
);
const minimumDeliveryOrder =
  Number.isFinite(configuredMinimum) && configuredMinimum > 0
    ? configuredMinimum
    : 50;

function parseManualItems(text: string) {
  return text
    .split(/\r?\n|[,;]/)
    .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

interface SavedList {
  id: string;
  name: string;
  items: CartItem[];
  manualItems?: string[];
  savedAt: string;
}

type CheckoutPayment = 'pix' | 'card' | 'cash' | 'food_voucher';

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    cart,
    itemCount,
    total,
    savings,
    addToCart,
    changeQuantity,
    removeFromCart,
  } = useShoppingCart();
  const { settings, venda_online_ativa } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [manualListText, setManualListText] = useState('');
  const [completedManualItems, setCompletedManualItems] = useState<Set<number>>(
    new Set(),
  );
  const [listFeedback, setListFeedback] = useState('');
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>(
    'delivery',
  );
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPayment>('pix');
  const [changeFor, setChangeFor] = useState('');
  const [address, setAddress] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const enabledPaymentMethods = useMemo(
    () => [
      ...(settings.payments.pix.enabled ? [['pix', 'Pix'] as const] : []),
      ...(settings.payments.cardOnDelivery ? [['card', 'Cartão na entrega'] as const] : []),
      ...(settings.payments.cash ? [['cash', 'Dinheiro'] as const] : []),
      ...(settings.payments.foodVoucher ? [['food_voucher', 'Vale-alimentação'] as const] : []),
    ],
    [settings.payments],
  );
  const selectedPaymentMethod = enabledPaymentMethods.some(
    ([value]) => value === paymentMethod,
  )
    ? paymentMethod
    : enabledPaymentMethods[0]?.[0] ?? 'pix';
  const parsedManualItems = useMemo(
    () => parseManualItems(manualListText),
    [manualListText],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const storedLists = window.localStorage.getItem(
          recurringListsStorageKey,
        );
        if (storedLists) {
          const parsed: unknown = JSON.parse(storedLists);
          if (Array.isArray(parsed)) {
            setSavedLists(parsed as SavedList[]);
          }
        }
      } catch (error) {
        console.error('Não foi possível carregar as listas salvas.', error);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const deliveryRemaining = Math.max(0, minimumDeliveryOrder - total);
  const progress = Math.min(100, (total / minimumDeliveryOrder) * 100);
  const orderMessage = useMemo(
    () =>
      [
        `*Novo pedido — ${storeName}*`,
        '',
        `*Cliente:* ${customerName.trim()}`,
        `*Telefone:* ${customerPhone.trim()}`,
        `*Entrega:* ${deliveryMethod === 'delivery' ? 'Delivery' : 'Retirada na loja'}`,
        ...(deliveryMethod === 'delivery' ? [`*Endereço:* ${address.trim()}`] : []),
        `*Pagamento:* ${paymentMethodLabel(selectedPaymentMethod)}${selectedPaymentMethod === 'cash' && changeFor ? ` (troco para ${currency.format(Number(changeFor))})` : ''}`,
        '',
        '*Itens:*',
        ...cart.map(
          ({ product, quantity }) =>
            `• ${quantity}x ${product.name} — ${currency.format(product.price * quantity)}`,
        ),
        '',
        `*Subtotal:* ${currency.format(total)}`,
        `*Economia estimada:* ${currency.format(savings)}`,
        '',
        'Pedido enviado para confirmação da loja.',
      ].join('\n'),
    [
      address,
      cart,
      customerName,
      customerPhone,
      deliveryMethod,
      selectedPaymentMethod,
      changeFor,
      savings,
      storeName,
      total,
    ],
  );

  function persistLists(lists: SavedList[]) {
    setSavedLists(lists);
    try {
      window.localStorage.setItem(recurringListsStorageKey, JSON.stringify(lists));
    } catch (error) {
      console.error('Não foi possível salvar a lista neste dispositivo.', error);
    }
  }

  function saveRecurringList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const manualItems = parsedManualItems;
    if ((!cart.length && !manualItems.length) || !listName.trim()) {
      setListFeedback('Adicione produtos da sacola ou escreva itens na lista.');
      return;
    }

    const list: SavedList = {
      id: crypto.randomUUID(),
      name: listName.trim(),
      items: cart.map((item) => ({ ...item })),
      manualItems,
      savedAt: new Date().toISOString(),
    };
    persistLists([list, ...savedLists]);
    setListName('');
    setManualListText('');
    setListFeedback('');
    setSaveListOpen(false);
  }

  function getSavedListText(list: SavedList) {
    return [
      `*Lista de compras: ${list.name}*`,
      '',
      ...list.items.map(
        ({ product, quantity }) => `• ${quantity}x ${product.name}`,
      ),
      ...(list.manualItems ?? []).map((item) => `• ${item}`),
    ].join('\n');
  }

  function getManualListSummary() {
    return [
      `*Lista de compras: ${listName.trim() || 'Minha lista'}*`,
      '',
      ...parsedManualItems.map(
        (item, index) =>
          `${completedManualItems.has(index) ? '✅' : '•'} ${item}`,
      ),
    ].join('\n');
  }

  async function copyManualList() {
    try {
      await navigator.clipboard.writeText(getManualListSummary());
      setListFeedback('Lista manual copiada.');
    } catch (error) {
      console.error('Não foi possível copiar a lista manual.', error);
      setListFeedback('Não foi possível copiar. Verifique a permissão da área de transferência.');
    }
  }

  function shareManualList() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(getManualListSummary())}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function copySavedList(list: SavedList) {
    try {
      await navigator.clipboard.writeText(getSavedListText(list));
      setListFeedback(`Lista "${list.name}" copiada.`);
    } catch (error) {
      console.error('Não foi possível copiar a lista de compras.', error);
      setListFeedback('Não foi possível copiar. Verifique a permissão da área de transferência.');
    }
  }

  function shareSavedList(list: SavedList) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(getSavedListText(list))}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  function loadRecurringList(list: SavedList) {
    list.items.forEach(({ product, quantity }) => {
      addToCart(product, quantity);
    });
    setCheckoutSubmitted(false);
  }

  function removeRecurringList(id: string) {
    persistLists(savedLists.filter((list) => list.id !== id));
  }

  function createWhatsAppUrl() {
    return `https://wa.me/${settings.channels.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(orderMessage)}`;
  }

  function handleWhatsAppOrder() {
    setCheckoutError('');
    if (!settings.channels.whatsappEnabled) {
      setCheckoutError('O atendimento pelo WhatsApp está temporariamente indisponível.');
      return;
    }
    if (!cart.length) {
      setCheckoutError('Adicione pelo menos um produto para enviar o pedido.');
      return;
    }
    if (!settings.commerceEnabled) {
      setCheckoutError('As compras online estão temporariamente desativadas.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setCheckoutOpen(true);
      setCheckoutError('Informe seu nome e telefone para enviar o pedido.');
      return;
    }
    if (deliveryMethod === 'delivery' && total < minimumDeliveryOrder) {
      setCheckoutOpen(true);
      setCheckoutError(
        `O pedido mínimo para delivery é ${currency.format(minimumDeliveryOrder)}. Adicione mais ${currency.format(deliveryRemaining)} ou escolha retirada na loja.`,
      );
      return;
    }
    if (deliveryMethod === 'delivery' && !address.trim()) {
      setCheckoutOpen(true);
      setCheckoutError('Informe o endereço de entrega para continuar.');
      return;
    }
    submitOrderToDatabase(true);
  }

  function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError('');
    if (!settings.commerceEnabled) {
      setCheckoutError('As compras online estão temporariamente desativadas.');
      return;
    }
    if (!enabledPaymentMethods.length) {
      setCheckoutError('A loja ainda não configurou uma forma de pagamento disponível.');
      return;
    }
    if (deliveryMethod === 'delivery' && !address.trim()) {
      setCheckoutError('Informe o endereço completo para a entrega.');
      return;
    }
    if (deliveryMethod === 'delivery' && total < minimumDeliveryOrder) {
      setCheckoutError(
        `O pedido mínimo para delivery é ${currency.format(minimumDeliveryOrder)}. Adicione mais ${currency.format(deliveryRemaining)} ou escolha retirada na loja.`,
      );
      return;
    }
    submitOrderToDatabase(false);
  }

  function submitOrderToDatabase(sendToWhatsApp: boolean) {
    const whatsappWindow = sendToWhatsApp
      ? window.open('about:blank', '_blank')
      : null;
    if (sendToWhatsApp && !whatsappWindow) {
      setCheckoutError(
        'O navegador bloqueou a nova janela. Permita pop-ups para enviar o pedido.',
      );
      return;
    }
    if (whatsappWindow) whatsappWindow.opener = null;
    setSubmittingOrder(true);
    void (async () => {
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        const { error } = await supabaseBrowser.from('pedidos').insert({
          cliente_id: user?.id ?? null,
          cliente_nome: customerName.trim(),
          cliente_telefone: customerPhone.trim(),
          endereco: deliveryMethod === 'delivery' ? address.trim() : null,
          metodo_entrega: deliveryMethod,
          metodo_pagamento: selectedPaymentMethod,
          troco_para: selectedPaymentMethod === 'cash' && changeFor ? Number(changeFor) : null,
          itens_json: cart.map(({ product, quantity }) => ({
            produto_id: product.id,
            nome: product.name,
            quantidade: quantity,
            preco_unitario: product.price,
            subtotal: product.price * quantity,
          })),
          total,
          status: 'recebido',
        });
        if (error) {
          whatsappWindow?.close();
          setCheckoutError(`Não foi possível registrar o pedido: ${error.message}`);
          return;
        }
        if (whatsappWindow && settings.channels.whatsappEnabled) {
          whatsappWindow.location.href = createWhatsAppUrl();
        } else {
          whatsappWindow?.close();
        }
        setCheckoutSubmitted(true);
      } catch (error) {
        whatsappWindow?.close();
        setCheckoutError(
          error instanceof Error
            ? `Não foi possível registrar o pedido: ${error.message}`
            : 'Não foi possível registrar o pedido.',
        );
      } finally {
        setSubmittingOrder(false);
      }
    })();
  }

  if (!open || !venda_online_ativa) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar carrinho"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="cart-drawer-title" className="m-0 text-xl font-black text-slate-900">
              Sua sacola
            </h2>
            <p className="mb-0 mt-1 text-sm text-slate-500">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && settings.commerceEnabled && (
              <button
                type="button"
                onClick={() => {
                  cart.forEach((item) => removeFromCart(item.product.id));
                  setCheckoutSubmitted(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
                <span className="hidden sm:inline">Limpar sacola</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar sacola"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {cart.length > 0 && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 sm:px-6">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-900">
                <Truck size={15} />
                {deliveryRemaining > 0
                  ? `Faltam ${currency.format(deliveryRemaining)} para o mínimo do delivery`
                  : 'Pedido mínimo para delivery atingido'}
              </span>
              <span className="shrink-0 font-bold text-emerald-800">
                {currency.format(minimumDeliveryOrder)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progresso para o mínimo de entrega"
              aria-valuemin={0}
              aria-valuemax={minimumDeliveryOrder}
              aria-valuenow={Math.min(total, minimumDeliveryOrder)}
              className="h-1.5 overflow-hidden rounded-full bg-emerald-200"
            >
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length ? (
            <ul className="list-none space-y-3 p-5 sm:p-6">
              {cart.map(({ product, quantity }) => (
                <li
                  key={product.id}
                  className="flex gap-3 rounded-2xl border border-slate-100 p-3"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-emerald-700">
                        <ShoppingBasket size={24} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 line-clamp-2 text-sm font-bold text-slate-800">
                      {product.name}
                    </p>
                    <p className="mb-2 mt-1 text-xs text-slate-500">{product.unit}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, -1)}
                          aria-label={`Diminuir quantidade de ${product.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(product.id, 1)}
                          aria-label={`Aumentar quantidade de ${product.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-sm font-black text-emerald-800">
                        {currency.format(product.price * quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <ShoppingBasket size={32} className="text-emerald-700" />
              <p className="mb-0 mt-3 font-bold text-slate-800">Sua sacola está vazia</p>
              <p className="mb-0 mt-1 text-sm text-slate-500">Explore ofertas e adicione seus produtos favoritos.</p>
            </div>
          )}

          <section className="mx-5 mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:mx-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 flex items-center gap-2 text-sm font-black">
                <ClipboardList size={17} className="text-emerald-800" />
                Listas recorrentes
              </h3>
              <button
                type="button"
                onClick={() => setSaveListOpen((value) => !value)}
                className="text-xs font-bold text-emerald-800 hover:underline"
              >
                {saveListOpen ? 'Fechar' : 'Nova lista'}
              </button>
            </div>

            {saveListOpen && (
              <form onSubmit={saveRecurringList} className="mb-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="recurring-list-name">Nome da lista</label>
                <input
                  id="recurring-list-name"
                  required
                  maxLength={80}
                  value={listName}
                  onChange={(event) => setListName(event.target.value)}
                  placeholder="Ex.: Compras do Mês"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
                <label className="block text-xs font-semibold text-slate-700" htmlFor="manual-list-items">Digitar Lista Manual (um item por linha, ou separados por vírgula)</label>
                <textarea
                  id="manual-list-items"
                  rows={4}
                  value={manualListText}
                  onChange={(event) => {
                    setManualListText(event.target.value);
                    setCompletedManualItems(new Set());
                  }}
                  placeholder={'Leite\nPão integral\nBanana'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
                {parsedManualItems.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="m-0 text-xs font-bold text-slate-700">
                      Sua lista ({parsedManualItems.length} itens)
                    </p>
                    <ul className="m-0 list-none space-y-2 p-0">
                      {parsedManualItems.map((item, index) => (
                        <li key={`${index}-${item}`}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={completedManualItems.has(index)}
                              onChange={(event) => {
                                setCompletedManualItems((current) => {
                                  const updated = new Set(current);
                                  if (event.target.checked) updated.add(index);
                                  else updated.delete(index);
                                  return updated;
                                });
                              }}
                              className="accent-emerald-700"
                            />
                            <span className={completedManualItems.has(index) ? 'text-slate-400 line-through' : ''}>
                              {item}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void copyManualList()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        Copiar lista
                      </button>
                      <button
                        type="button"
                        onClick={shareManualList}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1fbd5b]"
                      >
                        <MessageCircle size={14} />
                        Compartilhar no WhatsApp
                      </button>
                    </div>
                  </div>
                )}
                {cart.length > 0 && <p className="m-0 text-xs text-slate-500">Os {cart.length} produto(s) da sacola também serão incluídos.</p>}
                <button type="submit" className="w-full rounded-lg bg-emerald-800 px-3 py-2.5 text-sm font-bold text-white">
                  Salvar lista
                </button>
              </form>
            )}

            {listFeedback && <p role="status" className="mb-3 rounded-lg bg-white p-2 text-xs text-slate-600">{listFeedback}</p>}
            {savedLists.length ? (
              <ul className="m-0 list-none space-y-2 p-0">
                {savedLists.map((list) => (
                  <li key={list.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{list.name}</span>
                      <span className="text-xs text-slate-500">
                        {list.items.reduce((sum, item) => sum + item.quantity, 0) + (list.manualItems?.length ?? 0)} itens
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {list.items.length > 0 && <button type="button" onClick={() => loadRecurringList(list)} className="rounded px-2 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50">Recarregar</button>}
                      <button type="button" onClick={() => void copySavedList(list)} aria-label={`Copiar lista ${list.name}`} title="Copiar lista" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Copy size={14} /></button>
                      <button type="button" onClick={() => shareSavedList(list)} aria-label={`Compartilhar lista ${list.name} no WhatsApp`} title="Compartilhar no WhatsApp" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><MessageCircle size={14} /></button>
                      <button type="button" onClick={() => removeRecurringList(list.id)} aria-label={`Excluir lista ${list.name}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-xs text-slate-500">
                Salve sua sacola para repetir esta compra mais tarde.
              </p>
            )}
          </section>

          {checkoutOpen && cart.length > 0 && (
            <form
              id="checkout-form"
              onSubmit={submitCheckout}
              className="mx-5 mb-5 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:mx-6"
            >
              <div>
                <h3 className="m-0 text-base font-black">Dados para o pedido</h3>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  A loja confirma a disponibilidade e os detalhes pelo WhatsApp.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  Nome completo
                  <input
                    required
                    autoComplete="name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Telefone / WhatsApp
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
              </div>

              <fieldset className="border-0 p-0">
                <legend className="mb-2 text-xs font-bold text-slate-700">Como deseja receber?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <input type="radio" name="delivery-method" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} className="accent-emerald-700" />
                    <Truck size={16} /> Delivery
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <input type="radio" name="delivery-method" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="accent-emerald-700" />
                    <ShoppingBasket size={16} /> Retirada
                  </label>
                </div>
              </fieldset>

              {deliveryMethod === 'delivery' && (
                <label className="block text-xs font-semibold text-slate-700">
                  Endereço de entrega
                  <textarea
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Rua, número, bairro, cidade e complemento"
                    rows={2}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
              )}

              <fieldset className="border-0 p-0">
                <legend className="mb-2 text-xs font-bold text-slate-700">Forma de pagamento</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {enabledPaymentMethods.map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <input type="radio" name="payment-method" checked={selectedPaymentMethod === value} onChange={() => setPaymentMethod(value)} className="accent-emerald-700" />
                      {label}
                    </label>
                  ))}
                </div>
                {!enabledPaymentMethods.length && <p className="mt-2 text-xs text-rose-700">A loja ainda não habilitou métodos de pagamento. Entre em contato para finalizar.</p>}
              </fieldset>
              {selectedPaymentMethod === 'pix' && settings.payments.pix.enabled && settings.payments.pix.key && (
                <p className="m-0 rounded-lg bg-white p-3 text-xs text-slate-700">
                  Chave Pix da loja: <strong>{settings.payments.pix.key}</strong>
                </p>
              )}
              {selectedPaymentMethod === 'cash' && settings.payments.cash && (
                <label className="block text-xs font-semibold text-slate-700">
                  Troco para (opcional)
                  <input
                    type="number"
                    min={total}
                    step="0.01"
                    value={changeFor}
                    onChange={(event) => setChangeFor(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              )}

              {checkoutError && (
                <p role="alert" className="m-0 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {checkoutError}
                </p>
              )}
              {checkoutSubmitted && (
                <p role="status" className="m-0 flex items-center gap-2 rounded-lg bg-emerald-100 p-3 text-xs font-semibold text-emerald-900">
                  <Check size={16} />
                  Pedido registrado. A equipe da loja confirmará disponibilidade e condições.
                </p>
              )}
              <button type="submit" disabled={!settings.commerceEnabled || !enabledPaymentMethods.length || submittingOrder} className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
                {submittingOrder ? 'Registrando pedido...' : 'Confirmar pedido próprio'}
              </button>
            </form>
          )}
        </div>

        <div className="max-h-[45vh] shrink-0 space-y-3 overflow-y-auto border-t border-slate-100 bg-white p-5 sm:p-6">
          {cart.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">{currency.format(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-800">
                <span>Economia estimada nas ofertas</span>
                <span className="font-bold">− {currency.format(savings)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-lg font-black">
                <span>Total dos produtos</span>
                <span className="text-emerald-800">{currency.format(total)}</span>
              </div>
            </>
          )}

          {checkoutError && !checkoutOpen && (
            <p role="alert" className="m-0 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {checkoutError}
            </p>
          )}

          {!settings.commerceEnabled && (
            <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Compras online pausadas. O catálogo continua disponível como vitrine.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setCheckoutOpen(true);
              setCheckoutError('');
            }}
            disabled={!settings.commerceEnabled || !enabledPaymentMethods.length || cart.length === 0 || submittingOrder}
            className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {checkoutOpen ? 'Dados do pedido abertos' : 'Checkout próprio'}
          </button>
          {settings.channels.whatsappEnabled && (
          <button
            type="button"
            onClick={handleWhatsAppOrder}
            disabled={!settings.commerceEnabled || !enabledPaymentMethods.length || cart.length === 0 || submittingOrder}
            className="w-full rounded-xl bg-[#25D366] py-3 font-bold text-white transition hover:bg-[#1fbd5b] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Enviar pedido via WhatsApp
          </button>
          )}
          {settings.channels.ifoodEnabled && isSafeWebUrl(settings.channels.ifoodUrl) && (
          <a
            href={settings.channels.ifoodUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-xl border border-orange-200 bg-orange-50 py-3 text-center text-sm font-bold text-orange-800 transition hover:bg-orange-100"
          >
            Pedir pela loja oficial no iFood
          </a>
          )}
        </div>
      </aside>

      {saveListOpen && (
        <div className="sr-only" aria-live="polite">
          Formulário para salvar lista de compras aberto.
        </div>
      )}
    </div>
  );
}

function paymentMethodLabel(method: CheckoutPayment) {
  if (method === 'pix') return 'Pix';
  if (method === 'card') return 'Cartão na entrega';
  if (method === 'food_voucher') return 'Vale-alimentação';
  return 'Dinheiro';
}
