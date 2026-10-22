'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Clipboard, ListPlus, LogIn, LogOut, MessageCircle, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog-types';
import { useShoppingCart } from './cart-provider';
import { useSiteSettings } from './admin-data-provider';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface CustomerListItem {
  product_id: string;
  quantity: number;
}

interface CustomerList {
  id: string;
  nome: string;
  itens_json: CustomerListItem[];
  atualizado_em: string;
}

interface CustomerOrder {
  id: string;
  criado_em: string;
  total: number;
  status: string;
  itens_json: Array<{ nome: string; quantidade: number; subtotal: number }>;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CustomerAccount({ products }: { products: CatalogProduct[] }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [lists, setLists] = useState<CustomerList[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [listName, setListName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { addToCart } = useShoppingCart();
  const { settings } = useSiteSettings();

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    void supabaseBrowser.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(`Não foi possível verificar a conta: ${sessionError.message}`);
      setUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    void Promise.all([
      supabaseBrowser.from('listas_compras').select('id,nome,itens_json,atualizado_em').order('atualizado_em', { ascending: false }),
      supabaseBrowser.from('pedidos').select('id,criado_em,total,status,itens_json').eq('cliente_id', userId).order('criado_em', { ascending: false }).limit(50),
    ]).then(([listResult, orderResult]) => {
      const loadError = listResult.error ?? orderResult.error;
      if (loadError) {
        if (active) setError(`Não foi possível carregar histórico e listas: ${loadError.message}`);
        return;
      }
      if (!active) return;
      setLists((listResult.data ?? []).map((list) => ({
        ...list,
        itens_json: Array.isArray(list.itens_json) ? list.itens_json as CustomerListItem[] : [],
      })));
      setOrders((orderResult.data ?? []) as CustomerOrder[]);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Erro ao carregar sua conta.');
    });
    return () => { active = false; };
  }, [userId]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const result = createAccount
      ? await supabaseBrowser.auth.signUp({
          email,
          password,
          options: { data: { full_name: String(form.get('name') ?? '').trim() } },
        })
      : await supabaseBrowser.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setError(`Não foi possível ${createAccount ? 'criar a conta' : 'entrar'}: ${result.error.message}`);
      return;
    }
    if (createAccount && !result.data.session) {
      setMessage('Cadastro iniciado. Confirme o e-mail enviado para ativar sua conta.');
      return;
    }
    setLists([]);
    setOrders([]);
    setUserId(result.data.user?.id ?? null);
    setMessage(createAccount ? 'Conta criada com sucesso.' : 'Login realizado.');
  }

  async function signOut() {
    const { error: signOutError } = await supabaseBrowser.auth.signOut();
    if (signOutError) setError(`Não foi possível encerrar a sessão: ${signOutError.message}`);
    else {
      setUserId(null);
      setMessage('Você saiu da sua conta.');
    }
  }

  async function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const name = listName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    const { data, error: createError } = await supabaseBrowser
      .from('listas_compras')
      .insert({ usuario_id: userId, nome: name, itens_json: [] })
      .select('id,nome,itens_json,atualizado_em')
      .single();
    setBusy(false);
    if (createError) {
      setError(`Não foi possível criar a lista: ${createError.message}`);
      return;
    }
    const list = { ...data, itens_json: [] as CustomerListItem[] };
    setLists((current) => [list, ...current]);
    setSelectedListId(list.id);
    setListName('');
    setMessage(`Lista "${list.nome}" criada. Agora escolha produtos para adicionar.`);
  }

  async function changeList(items: CustomerListItem[]) {
    if (!selectedList) return;
    setError('');
    const { error: updateError } = await supabaseBrowser
      .from('listas_compras')
      .update({ itens_json: items, atualizado_em: new Date().toISOString() })
      .eq('id', selectedList.id);
    if (updateError) {
      setError(`Não foi possível atualizar a lista: ${updateError.message}`);
      return;
    }
    setLists((current) => current.map((list) => list.id === selectedList.id ? { ...list, itens_json: items } : list));
  }

  async function addProductToList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedList || !selectedProductId) return;
    const existing = selectedList.itens_json.find((item) => item.product_id === selectedProductId);
    const items = existing
      ? selectedList.itens_json.map((item) => item.product_id === selectedProductId ? { ...item, quantity: item.quantity + quantity } : item)
      : [...selectedList.itens_json, { product_id: selectedProductId, quantity }];
    await changeList(items);
    setQuantity(1);
  }

  async function deleteList(list: CustomerList) {
    const { error: deleteError } = await supabaseBrowser.from('listas_compras').delete().eq('id', list.id);
    if (deleteError) {
      setError(`Não foi possível excluir a lista: ${deleteError.message}`);
      return;
    }
    setLists((current) => current.filter((item) => item.id !== list.id));
    if (selectedListId === list.id) setSelectedListId('');
  }

  function listMessage(list: CustomerList) {
    return [
      `*Lista de compras: ${list.nome}*`,
      ...list.itens_json.map((item) => {
        const product = productsById.get(item.product_id);
        return `• ${item.quantity}x ${product?.name ?? 'Produto indisponível'}`;
      }),
      '',
      'VerdeVale Supermercados',
    ].join('\n');
  }

  async function copyList(list: CustomerList) {
    try {
      await navigator.clipboard.writeText(listMessage(list));
      setMessage('Cópia da lista pronta para colar.');
    } catch (clipboardError) {
      console.error('Não foi possível acessar a área de transferência.', clipboardError);
      setMessage(listMessage(list));
    }
  }

  if (!authReady) return <main className="mx-auto max-w-5xl px-4 py-16">Carregando sua conta…</main>;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-emerald-900 p-6 text-white sm:p-8">
          <Link href="/" className="text-sm font-bold text-emerald-100 hover:underline">← Voltar à loja</Link>
          <h1 className="mb-2 mt-5 text-3xl font-black">Minha conta VerdeVale</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-emerald-100">Acesse seu histórico de pedidos e mantenha listas de compras sincronizadas com sua conta.</p>
        </header>

        {!userId ? (
          <form onSubmit={authenticate} className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="m-0 text-xl font-black">{createAccount ? 'Criar conta de cliente' : 'Entrar na conta'}</h2>
            {createAccount && <label className="block text-sm font-semibold">Nome completo<input name="name" required minLength={2} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label>}
            <label className="block text-sm font-semibold">E-mail<input name="email" required type="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /></label>
            <label className="block text-sm font-semibold">Senha<input name="password" required type="password" minLength={8} autoComplete={createAccount ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3" /><span className="mt-1 block text-xs text-slate-500">Mínimo de 8 caracteres.</span></label>
            <button disabled={busy} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 font-bold text-white disabled:opacity-60"><LogIn size={17} />{busy ? 'Aguarde…' : createAccount ? 'Criar conta' : 'Entrar'}</button>
            <button type="button" onClick={() => { setCreateAccount((value) => !value); setError(''); setMessage(''); }} className="w-full text-sm font-bold text-emerald-800 hover:underline">{createAccount ? 'Já tem uma conta? Entre' : 'Ainda não tem conta? Cadastre-se'}</button>
            <p className="m-0 text-xs leading-5 text-slate-500">Sua senha é gerenciada pelo Supabase Auth e não é armazenada pela VerdeVale.</p>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4">
              <p className="m-0 text-sm font-semibold text-emerald-900">Conta conectada · dados salvos com segurança</p>
              <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"><LogOut size={16} />Sair</button>
            </div>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div><h2 className="m-0 flex items-center gap-2 text-xl font-black"><ListPlus size={21} className="text-emerald-700" />Minhas listas</h2><p className="mb-0 mt-1 text-sm text-slate-500">Crie primeiro uma lista pelo nome e adicione produtos depois.</p></div>
              <form onSubmit={createList} className="flex flex-wrap gap-2">
                <input required maxLength={80} value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Ex.: Churrasco de Sábado" className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                <button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white"><ListPlus size={16} />Criar lista</button>
              </form>
              {lists.length > 0 && (
                <label className="block text-sm font-semibold">Selecione a lista para editar
                  <select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <option value="">Escolha uma lista</option>
                    {lists.map((list) => <option key={list.id} value={list.id}>{list.nome}</option>)}
                  </select>
                </label>
              )}
              {selectedList && (
                <>
                  <form onSubmit={addProductToList} className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                    <select required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                      <option value="">Escolha um produto</option>
                      {products.filter((product) => product.active !== false).map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(product.price)}</option>)}
                    </select>
                    <input aria-label="Quantidade do produto" type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                    <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white"><Plus size={16} />Adicionar</button>
                  </form>
                  <ul className="space-y-2 p-0">
                    {selectedList.itens_json.map((item) => {
                      const product = productsById.get(item.product_id);
                      return <li key={item.product_id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span>{item.quantity} × {product?.name ?? 'Produto indisponível'}</span><button type="button" aria-label={`Remover ${product?.name ?? 'produto'}`} onClick={() => void changeList(selectedList.itens_json.filter((row) => row.product_id !== item.product_id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></li>;
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copyList(selectedList)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-800"><Clipboard size={16} />Gerar cópia da lista</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(listMessage(selectedList))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"><MessageCircle size={16} />Compartilhar no WhatsApp</a>
                    <button type="button" onClick={() => selectedList.itens_json.forEach((item) => { const product = productsById.get(item.product_id); if (product) addToCart(product, item.quantity); })} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white"><ShoppingBag size={16} />Carregar no carrinho</button>
                    <button type="button" onClick={() => void deleteList(selectedList)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">Excluir lista</button>
                  </div>
                </>
              )}
              {!lists.length && <p className="m-0 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Nenhuma lista criada ainda.</p>}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="m-0 flex items-center gap-2 text-xl font-black"><ShoppingBag size={21} className="text-emerald-700" />Histórico de compras</h2>
              {busy && <p role="status" className="text-sm text-slate-500">Carregando pedidos e listas…</p>}
              {!busy && orders.length === 0 && <p className="m-0 text-sm text-slate-500">Seus pedidos confirmados aparecerão aqui.</p>}
              {orders.map((order) => (
                <article key={order.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap justify-between gap-2"><strong>{new Date(order.criado_em).toLocaleString('pt-BR')}</strong><span className="font-bold text-emerald-800">{money.format(Number(order.total))} · {order.status}</span></div>
                  <p className="mb-0 mt-2 text-sm text-slate-600">{order.itens_json.map((item) => `${item.quantidade} × ${item.nome}`).join(' · ')}</p>
                </article>
              ))}
            </section>
          </>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="break-words rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
        {settings.channels.whatsappEnabled && <a href={`https://wa.me/${settings.channels.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="block text-center text-sm font-bold text-emerald-800">Precisa de ajuda? Fale com a loja</a>}
      </div>
    </main>
  );
}
