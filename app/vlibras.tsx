'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    VLibras?: {
      Widget: new (
        pathOrOptions?:
          | string
          | {
              rootPath?: string;
              personalization?: string;
              avatar?: string;
              position?: 'left' | 'right' | 'l' | 'r';
            },
        personalization?: string,
        avatar?: string,
        position?: string,
      ) => void;
    };
    VLibrasWidget?: {
      path?: string;
      initBtn?: HTMLElement;
      access?: HTMLElement;
      open?: () => void;
      position?: string;
      avatar?: string;
      personalization?: string;
    };
    __vlibras_initialized?: boolean;
  }
}

/**
 * Abre programaticamente o widget e avatar de tradução do VLibras
 * acionando a API v7 oficial ou clicando no botão de acesso.
 */
export function openVLibras() {
  if (typeof window === 'undefined') return;

  const tryOpen = () => {
    // 1. API v7 nativa (VLibrasWidget.open())
    if (typeof window.VLibrasWidget?.open === 'function') {
      window.VLibrasWidget.open();
      return true;
    }

    // 2. Botão nativo registrado em VLibrasWidget.initBtn
    if (window.VLibrasWidget?.initBtn) {
      window.VLibrasWidget.initBtn.click();
      return true;
    }

    // 3. Shadow DOM de #vlibras-access-wrapper
    const wrapper = document.getElementById('vlibras-access-wrapper');
    if (wrapper?.shadowRoot) {
      const btn = wrapper.shadowRoot.querySelector('#vlibras-button') as HTMLElement | null;
      if (btn) {
        btn.click();
        return true;
      }
    }

    // 4. Elemento padrão com atributo [vw-access-button]
    const accessButton =
      (document.querySelector('[vw-access-button]') as HTMLElement | null) ??
      (document.querySelector('.access-button') as HTMLElement | null);
    if (accessButton) {
      accessButton.click();
      return true;
    }

    return false;
  };

  if (!tryOpen()) {
    // Tenta novamente após pequeno intervalo caso o script ainda estivesse finalizando a carga
    setTimeout(tryOpen, 250);
  }
}

export default function VLibras() {
  const init = () => {
    if (typeof window === 'undefined') return;
    if (window.__vlibras_initialized) return;

    if (window.VLibras?.Widget) {
      try {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
        window.__vlibras_initialized = true;
      } catch (err) {
        console.warn('Inicialização do VLibras:', err);
      }
    }
  };

  useEffect(() => {
    if (window.VLibras && !window.__vlibras_initialized) {
      init();
    }
  }, []);

  return (
    <>
      <div
        {...{ vw: 'true' }}
        className="enabled"
        style={{ zIndex: 2147483640 }}
        suppressHydrationWarning
      >
        <div {...{ 'vw-access-button': 'true' }} className="active" />
        <div {...{ 'vw-plugin-wrapper': 'true' }}>
          <div className="vw-plugin-top-wrapper" />
        </div>
      </div>
      <Script
        src="https://vlibras.gov.br/app/vlibras-plugin.js"
        strategy="lazyOnload"
        onLoad={init}
      />
    </>
  );
}
