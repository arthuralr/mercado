'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Smartphone,
  Star,
} from 'lucide-react';
import BrandLogo from './brand-logo';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from './admin-data-provider';
import { isSafeWebUrl } from '@/lib/site-settings';
import { openQuickShoppingList } from './shopping-list-tool';
import { OfficialSocialLinks } from './social-links';
import { openPwaInstallPrompt } from './pwa-install-banner';

export default function InstitutionalFooter() {
  const pathname = usePathname();
  const { settings, venda_online_ativa } = useSiteSettings();
  if (pathname.startsWith('/admin')) return null;

  const cleanWhatsappDigits = settings.channels.whatsappNumber.replace(/\D/g, '');
  const whatsappDigits = cleanWhatsappDigits.length >= 10 ? cleanWhatsappDigits : '551140044040';
  const whatsapp = `https://wa.me/${whatsappDigits}`;
  const footerSummary =
    settings.institution.aboutText
      .split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) || settings.institution.aboutText;

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <BrandLogo inverted />
          <p className="m-0 max-w-xs text-sm leading-relaxed text-zinc-400">
            {footerSummary}
          </p>
          <div
            className="flex items-center gap-1 text-yellow-400"
            aria-label="Avaliação 4,9 de 5"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} size={15} fill="currentColor" />
            ))}
            <span className="ml-2 text-xs font-medium text-zinc-400">
              4,9 de 5
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={openQuickShoppingList}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-400/20"
            >
              <ClipboardList size={15} />
              Crie sua Lista de Compras
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">
            Institucional e Navegação
          </h2>
          <ul className="m-0 grid grid-cols-1 gap-2 list-none p-0 text-sm text-zinc-400">
            <li>
              <Link href="/" className="transition-colors hover:text-white">
                Início
              </Link>
            </li>
            <li>
              <Link href="/catalogo" className="transition-colors hover:text-white">
                Catálogo de Produtos
              </Link>
            </li>
            <li>
              <Link
                href="/panfleto-de-ofertas"
                className="transition-colors hover:text-white"
              >
                Panfleto de Ofertas
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openQuickShoppingList}
                className="p-0 text-left text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Crie sua Lista de Compras
              </button>
            </li>
            <li>
              <Link href="/receitas" className="transition-colors hover:text-white">
                Receitas e Sugestões do Dia
              </Link>
            </li>
            <li>
              <Link href="/sobre" className="transition-colors hover:text-white">
                Quem somos
              </Link>
            </li>
            <li>
              <Link href="/lojas" className="transition-colors hover:text-white">
                Nossas lojas e filiais
              </Link>
            </li>
            <li>
              <Link href="/clube" className="transition-colors hover:text-white">
                Clube de Descontos
              </Link>
            </li>
            {settings.features.cardApplicationsEnabled && (
              <li>
                <Link
                  href="/cartao-loja"
                  className="transition-colors hover:text-white"
                >
                  Cartão da Loja
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/trabalhe-conosco"
                className="transition-colors hover:text-white"
              >
                Trabalhe Conosco
              </Link>
            </li>
            <li>
              <Link
                href="/privacidade"
                className="transition-colors hover:text-white"
              >
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link href="/bio" className="transition-colors hover:text-white">
                Links oficiais
              </Link>
            </li>
            {venda_online_ativa && (
              <li>
                <Link href="/conta" className="transition-colors hover:text-white">
                  Minha conta
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">
            Atendimento e Loja
          </h2>
          <p className="m-0 flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400">
            <MapPin size={16} className="mt-0.5 shrink-0 text-zinc-500" />
            <span>{settings.institution.address}</span>
          </p>
          <p className="m-0 flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-zinc-500" />
            <span>{settings.institution.hours}</span>
          </p>
          <div className="space-y-2 pt-1">
            <a
              href={`tel:${settings.institution.phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
                <MessageCircle size={15} />
              </span>
              {settings.institution.phone}
            </a>
            <a
              href={`mailto:${settings.institution.email}`}
              className="block break-all text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {settings.institution.email}
            </a>
            {settings.channels.whatsappEnabled && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366]/15 px-3 py-2 text-xs font-bold text-[#25D366] transition hover:bg-[#25D366]/25"
              >
                <MessageCircle size={15} />
                Atendimento via WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">
            Compra tranquila
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <ShieldCheck size={14} className="shrink-0 text-zinc-400" />
              Site seguro
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <Package size={14} className="shrink-0 text-zinc-400" />
              {venda_online_ativa ? 'Entrega garantida' : 'Qualidade garantida'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <BadgePercent size={14} className="shrink-0 text-zinc-400" />
              Preço justo
            </span>
          </div>

          <nav
            aria-label="Atalhos institucionais"
            className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-zinc-400"
          >
            <Link href="/sobre" className="transition-colors hover:text-white">
              Quem somos
            </Link>
            <Link href="/lojas" className="transition-colors hover:text-white">
              Lojas
            </Link>
            <Link href="/clube" className="transition-colors hover:text-white">
              Clube
            </Link>
            <Link
              href="/trabalhe-conosco"
              className="transition-colors hover:text-white"
            >
              Trabalhe conosco
            </Link>
            <Link
              href="/privacidade"
              className="transition-colors hover:text-white"
            >
              Privacidade
            </Link>
            <Link href="/bio" className="transition-colors hover:text-white">
              Links oficiais
            </Link>
            <Link href="/receitas" className="transition-colors hover:text-white">
              Receitas
            </Link>
          </nav>

          <div className="space-y-2.5 pt-2">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-300">
              Siga nas Redes Sociais
            </p>
            <OfficialSocialLinks variant="pills" />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-zinc-400">
            {settings.channels.ifoodEnabled &&
              isSafeWebUrl(settings.channels.ifoodUrl) && (
                <a
                  href={settings.channels.ifoodUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Peça pelo iFood
                </a>
              )}
            {isSafeWebUrl(settings.channels.offersGroupUrl) && (
              <a
                href={settings.channels.offersGroupUrl}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-white"
              >
                Ofertas no WhatsApp
              </a>
            )}
          </div>

          {settings.pwa.enabled && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={openPwaInstallPrompt}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-white"
              >
                <Smartphone size={14} />
                Instalar o App / Atalho no Telemóvel
              </button>
              {settings.pwa.googlePlay.enabled &&
                isSafeWebUrl(settings.pwa.googlePlay.url) && (
                  <a
                    href={settings.pwa.googlePlay.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    Google Play
                  </a>
                )}
              {settings.pwa.appStore.enabled &&
                isSafeWebUrl(settings.pwa.appStore.url) && (
                  <a
                    href={settings.pwa.appStore.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    App Store
                  </a>
                )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-zinc-500 sm:px-6 lg:px-8">
          <span>
            © 2026 {settings.institution.storeName} · Os preços e a disponibilidade podem variar por loja.
          </span>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Acesso do gestor <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
