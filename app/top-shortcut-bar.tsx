'use client';

import Link from 'next/link';
import {
  Accessibility,
  FileText,
  Headphones,
  MessageCircle,
  Smartphone,
  Sparkles,
  Store,
} from 'lucide-react';
import { useSiteSettings } from './admin-data-provider';
import { getStoreWhatsappUrl } from '@/lib/site-settings';
import { openPwaInstallPrompt } from './pwa-install-banner';
import { openVLibras } from './vlibras';

export default function TopShortcutBar() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';

  const whatsappOfertasUrl = getStoreWhatsappUrl(
    settings,
    `Olá! Gostaria de receber o panfleto e as melhores ofertas da semana no WhatsApp da loja ${storeName}.`,
  );

  const rawPhone = settings.institution.phone.replace(/\D/g, '');
  const atendimentoUrl = settings.channels.whatsappEnabled
    ? getStoreWhatsappUrl(
        settings,
        `Olá! Gostaria de falar com a Central de Atendimento / SAC da loja ${storeName}.`,
      )
    : rawPhone
      ? `tel:${rawPhone}`
      : '/sobre#contato';

  const isAtendimentoExternal = atendimentoUrl.startsWith('http') || atendimentoUrl.startsWith('tel');

  return (
    <aside
      aria-label="Atalhos rápidos e canais de atendimento"
      className="border-b border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-1.5 sm:px-4 lg:px-8">
        {/* Lado esquerdo (Desktop): Reafirmação institucional amigável */}
        <div className="hidden items-center gap-2 text-xs text-slate-600 md:flex">
          <span className="flex items-center gap-1.5 font-bold text-slate-800">
            <Sparkles size={13} className="text-emerald-700" />
            <span>{storeName}</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-medium text-slate-500">
            Economia, qualidade e atendimento para você
          </span>
        </div>

        {/* Faixa de pílulas / badges estilizadas com rolagem suave no mobile */}
        <nav
          aria-label="Atalhos rápidos"
          className="flex w-full items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:w-auto md:justify-end md:gap-2"
        >
          {/* 1. Baixar App */}
          <button
            type="button"
            onClick={openPwaInstallPrompt}
            aria-label="Baixar aplicativo do supermercado para o telemóvel"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-amber-400 hover:bg-amber-100 active:scale-95 sm:px-3"
          >
            <Smartphone
              size={13}
              className="text-amber-700 transition group-hover:scale-110"
            />
            <span>Baixar App</span>
            <span className="hidden rounded-full bg-amber-200/90 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-950 sm:inline-block">
              Grátis
            </span>
          </button>

          {/* 2. Nossas Lojas */}
          <Link
            href="/lojas"
            aria-label="Ver endereços e horários de nossas lojas e filiais"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-95 sm:px-3"
          >
            <Store
              size={13}
              className="text-emerald-700 transition group-hover:scale-110"
            />
            <span>Nossas Lojas</span>
          </Link>

          {/* 3. Panfleto de Ofertas */}
          <Link
            href="/panfleto-de-ofertas"
            aria-label="Ver o panfleto e encarte digital de ofertas da semana"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-rose-300 hover:bg-rose-100 active:scale-95 sm:px-3"
          >
            <FileText
              size={13}
              className="text-rose-600 transition group-hover:scale-110"
            />
            <span>Panfleto de Ofertas</span>
          </Link>

          {/* 4. WhatsApp de Ofertas */}
          <a
            href={whatsappOfertasUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Receber panfleto e ofertas no WhatsApp"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition hover:border-emerald-500 hover:bg-emerald-700 active:scale-95 sm:px-3"
          >
            <MessageCircle
              size={13}
              className="transition group-hover:scale-110"
            />
            <span>WhatsApp de Ofertas</span>
          </a>

          {/* 5. Atendimento */}
          {isAtendimentoExternal ? (
            <a
              href={atendimentoUrl}
              target={atendimentoUrl.startsWith('http') ? '_blank' : undefined}
              rel={atendimentoUrl.startsWith('http') ? 'noreferrer' : undefined}
              aria-label="Falar com a central de atendimento e SAC"
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-400 hover:bg-slate-100 active:scale-95 sm:px-3"
            >
              <Headphones
                size={13}
                className="text-slate-600 transition group-hover:scale-110"
              />
              <span>Atendimento</span>
            </a>
          ) : (
            <Link
              href={atendimentoUrl}
              aria-label="Acessar informações de contato e SAC"
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-400 hover:bg-slate-100 active:scale-95 sm:px-3"
            >
              <Headphones
                size={13}
                className="text-slate-600 transition group-hover:scale-110"
              />
              <span>Atendimento</span>
            </Link>
          )}

          {/* 6. Atendimento em Libras (VLibras) */}
          <button
            type="button"
            onClick={openVLibras}
            aria-label="Atendimento em Libras (Língua Brasileira de Sinais) com VLibras"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-blue-400 hover:bg-blue-100 active:scale-95 sm:px-3"
          >
            <Accessibility
              size={13}
              className="text-blue-700 transition group-hover:scale-110"
            />
            <span>Atendimento em Libras</span>
            <span className="rounded-full bg-blue-200/90 px-1.5 py-0.2 text-[9px] font-black uppercase text-blue-950">
              VLibras
            </span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
