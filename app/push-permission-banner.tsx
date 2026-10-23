'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { getPublicVapidKey, urlBase64ToUint8Array } from '@/lib/vapid-config';
import { useSiteSettings } from './admin-data-provider';

const dismissalKey = 'verdevale-push-banner-dismissed';
const vapidPublicKey = getPublicVapidKey();

function keysMatch(existingBuffer: ArrayBuffer | null, expectedKey: Uint8Array): boolean {
  if (!existingBuffer) return true;
  const existing = new Uint8Array(existingBuffer);
  if (existing.byteLength !== expectedKey.byteLength) return false;
  for (let i = 0; i < existing.byteLength; i += 1) {
    if (existing[i] !== expectedKey[i]) return false;
  }
  return true;
}

export async function subscribeBrowserToPush(): Promise<PushSubscription> {
  if (
    !window.isSecureContext ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    throw new Error('Este navegador não suporta notificações Web Push.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const expectedServerKey = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (
    subscription &&
    !keysMatch(subscription.options?.applicationServerKey ?? null, expectedServerKey)
  ) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedServerKey,
    });
  }

  const { data } = await supabaseBrowser.auth.getSession();
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
    },
    body: JSON.stringify(subscription.toJSON()),
  });

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason =
      result && typeof result === 'object' && 'error' in result
        ? String(result.error)
        : 'Não foi possível salvar a inscrição.';
    throw new Error(reason);
  }

  return subscription;
}

export default function PushPermissionBanner() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const [supported, setSupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (
      !vapidPublicKey ||
      !window.isSecureContext ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return;
    }

    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setSupported(true);
      setPermission(Notification.permission);
      try {
        setDismissed(window.localStorage.getItem(dismissalKey) === 'true');
      } catch {
        setError('Não foi possível carregar as preferências de notificação deste navegador.');
      }
    });

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          if (active) setSubscribed(true);
          void subscribeBrowserToPush().catch(() => undefined);
        } else if (Notification.permission === 'granted') {
          await subscribeBrowserToPush();
          if (active) setSubscribed(true);
        }
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível verificar as notificações.',
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!supported || dismissed || subscribed || permission === 'denied') return null;

  function dismissBanner() {
    try {
      window.localStorage.setItem(dismissalKey, 'true');
      setDismissed(true);
    } catch {
      setError('Não foi possível salvar a preferência. Você pode fechar este aviso novamente depois.');
      setDismissed(true);
    }
  }

  async function subscribe() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError('');
    try {
      const granted =
        permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') {
        setError(
          'A permissão não foi concedida. Você pode alterá-la nas configurações do navegador.',
        );
        return;
      }

      await subscribeBrowserToPush();
      setSubscribed(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível ativar as notificações.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed bottom-24 left-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl sm:left-6">
      <button
        type="button"
        aria-label="Fechar aviso de notificações"
        onClick={dismissBanner}
        className="absolute right-2 top-2 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
          <BellRing size={19} />
        </span>
        <div>
          <p className="m-0 text-sm font-black text-slate-900">Receba ofertas e avisos</p>
          <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">
            Ative as notificações de {storeName}. Você pode desativá-las a qualquer momento nas
            configurações do navegador.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mb-0 mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void subscribe()}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Ativando…' : 'Quero receber notificações'}
      </button>
    </aside>
  );
}
