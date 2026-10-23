'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Download, Share2, Smartphone, X } from 'lucide-react';
import { useSiteSettings } from './admin-data-provider';
import { isSafeWebUrl } from '@/lib/site-settings';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = 'supermarket-pwa-banner-dismissed-v1';
const OPEN_PWA_EVENT = 'open-pwa-install-modal';

export function openPwaInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_PWA_EVENT));
}

export default function PwaInstallBanner() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installedMessage, setInstalledMessage] = useState('');

  useEffect(() => {
    const checkEnvironment = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean(
          (window.navigator as Navigator & { standalone?: boolean }).standalone,
        );
      setIsStandalone(standalone);

      const ua = window.navigator.userAgent || '';
      const iosDevice = /iPhone|iPad|iPod/i.test(ua);
      setIsIos(iosDevice);

      const mobileUa =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
          ua,
        );
      const mobileViewport =
        window.matchMedia('(max-width: 1024px)').matches ||
        window.matchMedia('(pointer: coarse)').matches;

      setIsMobileOrTablet(mobileUa || mobileViewport);

      try {
        const savedDismiss =
          window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
        setDismissed(savedDismiss);
      } catch {
        setDismissed(false);
      }
    };

    checkEnvironment();
    window.addEventListener('resize', checkEnvironment);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledMessage(`Atalho do ${storeName} instalado com sucesso!`);
      setTimeout(() => setInstalledMessage(''), 4000);
    };

    const handleManualOpen = () => {
      setDismissed(false);
      setShowInstructions(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(OPEN_PWA_EVENT, handleManualOpen);

    return () => {
      window.removeEventListener('resize', checkEnvironment);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(OPEN_PWA_EVENT, handleManualOpen);
    };
  }, [storeName]);

  if (!settings.pwa.enabled) return null;

  function dismissBanner() {
    setDismissed(true);
    setShowInstructions(false);
    try {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          dismissBanner();
        }
        return;
      } catch {
        // fallback to manual instructions if prompt fails
      }
    }
    setShowInstructions(true);
  }

  const showMobileBanner =
    !isStandalone &&
    !dismissed &&
    (isMobileOrTablet || Boolean(deferredPrompt));

  if (!showMobileBanner && !showInstructions && !installedMessage) {
    return null;
  }

  return (
    <>
      {installedMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-emerald-900 px-4 py-3 text-xs font-bold text-white shadow-2xl"
        >
          <Check size={16} className="shrink-0 text-emerald-300" />
          <span>{installedMessage}</span>
        </div>
      )}

      {showMobileBanner && !showInstructions && (
        <aside
          aria-label={`Instalar aplicativo ${storeName}`}
          className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-emerald-200/90 bg-white/95 p-3.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-md sm:left-4 sm:right-auto sm:bottom-4"
        >
          <div className="flex items-start gap-3">
            {settings.brand.logoUrl ? (
              <Image
                src={settings.brand.logoUrl}
                alt={storeName}
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-xs"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white shadow-sm">
                <Smartphone size={22} />
              </div>
            )}

            <div className="min-w-0 flex-1 pr-5">
              <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                Atalho no telemóvel
              </span>
              <p className="m-0 mt-0.5 truncate text-sm font-black text-slate-900">
                App {storeName}
              </p>
              <p className="m-0 mt-0.5 text-xs leading-4 text-slate-600">
                Instale a versão rápida do site no ecrã principal para ver ofertas e a sua lista de compras com 1 toque.
              </p>
            </div>

            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Continuar no navegador e fechar aviso"
              className="absolute right-2.5 top-2.5 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              <Download size={15} className="shrink-0" />
              <span>Instalar o App / Baixar versão</span>
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Continuar no navegador
            </button>
          </div>
        </aside>
      )}

      {showInstructions && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Como instalar o aplicativo ${storeName}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-xs sm:items-center"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
                  <Smartphone size={24} />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    Versão Web App (PWA)
                  </span>
                  <h2 className="m-0 text-lg font-black text-slate-900">
                    Instalar {storeName}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                aria-label="Fechar instruções"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 mt-3 text-xs leading-5 text-slate-600">
              Adicione o atalho oficial de <strong>{storeName}</strong> ao ecrã principal do seu telemóvel. É leve, gratuito e não ocupa memória!
            </p>

            {deferredPrompt && (
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-emerald-700"
              >
                <Download size={18} />
                Instalar agora no dispositivo
              </button>
            )}

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
              {isIos ? (
                <div>
                  <p className="m-0 flex items-center gap-1.5 font-black text-slate-900">
                    <Share2 size={15} className="text-emerald-700" />
                    No iPhone ou iPad (Safari):
                  </p>
                  <ol className="mb-0 mt-1.5 space-y-1 pl-4">
                    <li>
                      Toque no botão <strong>Compartilhar</strong> na barra inferior do navegador.
                    </li>
                    <li>
                      Role as opções e toque em <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
                    </li>
                    <li>
                      Confirme em <strong>Adicionar</strong> para criar o ícone de {storeName}.
                    </li>
                  </ol>
                </div>
              ) : (
                <>
                  <div>
                    <p className="m-0 font-black text-slate-900">
                      No Android (Chrome / Samsung Internet):
                    </p>
                    <ol className="mb-0 mt-1 space-y-1 pl-4">
                      <li>
                        Toque no menu <strong>⋮</strong> (três pontos no canto superior do navegador).
                      </li>
                      <li>
                        Selecione <strong>&ldquo;Instalar aplicativo&rdquo;</strong> ou <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>.
                      </li>
                    </ol>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5">
                    <p className="m-0 font-black text-slate-900">
                      No iPhone / iPad (Safari):
                    </p>
                    <p className="m-0 mt-0.5">
                      Toque em <strong>Compartilhar</strong> e depois em <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            {((settings.pwa.googlePlay.enabled &&
              isSafeWebUrl(settings.pwa.googlePlay.url)) ||
              (settings.pwa.appStore.enabled &&
                isSafeWebUrl(settings.pwa.appStore.url))) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {settings.pwa.googlePlay.enabled &&
                  isSafeWebUrl(settings.pwa.googlePlay.url) && (
                    <a
                      href={settings.pwa.googlePlay.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      Abrir na Google Play
                    </a>
                  )}
                {settings.pwa.appStore.enabled &&
                  isSafeWebUrl(settings.pwa.appStore.url) && (
                    <a
                      href={settings.pwa.appStore.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      Abrir na App Store
                    </a>
                  )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={dismissBanner}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Continuar a aceder pelo navegador
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
