'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useSiteSettings } from './admin-data-provider';
import PushPermissionBanner from './push-permission-banner';

export default function GlobalStoreChrome() {
  const pathname = usePathname();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Não foi possível registrar o service worker.', error);
      });
    }
  }, []);

  if (pathname.startsWith('/admin')) return null;
  const whatsappUrl = `https://wa.me/${settings.channels.whatsappNumber.replace(/\D/g, '')}`;

  return (
    <>
      {settings.topbar.enabled && settings.topbar.text && (
        <div className="sticky top-0 z-50 bg-emerald-900 px-4 py-2 text-center text-xs font-semibold text-white">
          {settings.topbar.text}
        </div>
      )}
      {settings.channels.whatsappEnabled && settings.channels.whatsappNumber.replace(/\D/g, '').length >= 10 && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Fale com a VerdeVale pelo WhatsApp"
          className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105"
        >
          <MessageCircle size={26} />
        </a>
      )}
      <PushPermissionBanner />
    </>
  );
}
