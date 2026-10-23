'use client';

import { useState, type FormEvent } from 'react';
import { BellRing, Send } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useSiteSettings } from '../admin-data-provider';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700';

export default function PushNotificationPanel() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('/');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  async function sendNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    setFeedback('');

    try {
      const { data, error: sessionError } = await supabaseBrowser.auth.getSession();
      if (sessionError) throw new Error(`Não foi possível verificar a sessão: ${sessionError.message}`);
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente no painel.');

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message,
          link,
          icon: settings.brand.logoUrl || '/icon.png',
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const reason =
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Falha ao enviar notificações.';
        throw new Error(reason);
      }
      if (
        !result ||
        typeof result !== 'object' ||
        !('sent' in result) ||
        !('total' in result) ||
        !('failed' in result) ||
        typeof result.sent !== 'number' ||
        typeof result.total !== 'number' ||
        typeof result.failed !== 'number'
      ) {
        throw new Error('O servidor retornou uma resposta inválida.');
      }
      const warning = 'warning' in result && typeof result.warning === 'string' ? ` ${result.warning}` : '';
      setFeedback(`${result.sent} de ${result.total} notificação(ões) enviada(s). ${result.failed} falha(s).${warning}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar as notificações.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 shrink-0 text-emerald-800" size={21} />
          <div>
            <h2 className="m-0 text-lg font-black text-emerald-950">Envio imediato para inscritos</h2>
            <p className="mb-0 mt-1 text-sm leading-6 text-emerald-950/75">
              O alerta será enviado aos navegadores que autorizaram receber novidades. Use apenas
              mensagens relevantes e informe ofertas ou avisos da loja.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={sendNotification} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <label className="block text-sm font-semibold text-slate-700">
          Título
          <input
            required
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
            placeholder="Oferta especial de hoje"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">{title.length}/80 caracteres</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Mensagem
          <textarea
            required
            maxLength={240}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={fieldClass}
            placeholder={`Confira as ofertas fresquinhas de ${storeName}.`}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">{message.length}/240 caracteres</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Link de destino
          <input
            required
            maxLength={500}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            className={fieldClass}
            placeholder="/panfleto-de-ofertas"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Informe um caminho interno, por exemplo /catalogo ou /panfleto-de-ofertas.
          </span>
        </label>
        {error && <p role="alert" className="m-0 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {feedback && <p role="status" className="m-0 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{feedback}</p>}
        <button
          type="submit"
          disabled={sending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          <Send size={17} />
          {sending ? 'Enviando notificações…' : 'Disparar para inscritos'}
        </button>
      </form>
    </div>
  );
}
