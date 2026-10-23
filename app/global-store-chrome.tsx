'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ClipboardList, MessageCircle } from 'lucide-react';
import { useSiteSettings } from './admin-data-provider';
import PushPermissionBanner from './push-permission-banner';
import PwaInstallBanner from './pwa-install-banner';
import QuickShoppingListModal, {
  openQuickShoppingList,
  useQuickShoppingListCount,
} from './shopping-list-tool';

export default function GlobalStoreChrome() {
  const pathname = usePathname();
  const { settings } = useSiteSettings();
  const listCount = useQuickShoppingListCount();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Não foi possível registrar o service worker.', error);
      });
    }
  }, []);

  if (pathname.startsWith('/admin')) return null;

  const cleanWhatsappDigits = settings.channels.whatsappNumber.replace(/\D/g, '');
  const whatsappDigits = cleanWhatsappDigits.length >= 10 ? cleanWhatsappDigits : '551140044040';
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Gostaria de atendimento da loja ${storeName}.`)}`;

  return (
    <>
      {settings.topbar.enabled && settings.topbar.text && (
        <div className="sticky top-0 z-50 bg-emerald-900 px-4 py-2 text-center text-xs font-semibold text-white">
          {settings.topbar.text}
        </div>
      )}

      <div
        aria-label="Ações rápidas de atendimento e lista de compras"
        className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 sm:bottom-5 sm:right-5"
      >
        <button
          type="button"
          onClick={openQuickShoppingList}
          aria-label="Abrir ferramenta Crie sua Lista de Compras"
          className="inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-zinc-900 px-4 py-3 text-xs font-black text-white shadow-xl transition hover:scale-105 hover:bg-zinc-800 sm:text-sm"
        >
          <ClipboardList size={19} className="shrink-0 text-amber-400" />
          <span>Crie sua Lista de Compras</span>
          {listCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-zinc-950">
              {listCount}
            </span>
          )}
        </button>

        {settings.channels.whatsappEnabled && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Atendimento via WhatsApp da loja ${storeName}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-xs font-black text-white shadow-xl ring-2 ring-white/80 transition hover:scale-105 hover:brightness-95 sm:text-sm"
          >
            <MessageCircle size={20} className="shrink-0" />
            <span>Atendimento WhatsApp</span>
          </a>
        )}
      </div>

      <QuickShoppingListModal />
      <PwaInstallBanner />
      <PushPermissionBanner />
    </>
  );
}
