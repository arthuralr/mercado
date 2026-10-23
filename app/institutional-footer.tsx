'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  Clock3,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
} from 'lucide-react';
import BrandLogo from './brand-logo';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from './admin-data-provider';
import { isSafeWebUrl } from '@/lib/site-settings';

export default function InstitutionalFooter() {
  const pathname = usePathname();
  const { settings } = useSiteSettings();
  if (pathname === '/' || pathname.startsWith('/admin')) return null;

  const whatsapp = `https://wa.me/${settings.channels.whatsappNumber.replace(/\D/g, '')}`;
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <BrandLogo inverted />
          <p className="m-0 max-w-xs text-sm leading-relaxed text-zinc-400">
            {settings.institution.aboutText}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">Institucional</h2>
          <ul className="m-0 list-none space-y-2 p-0 text-sm text-zinc-400">
            <li><Link href="/sobre" className="transition-colors hover:text-white">Quem somos</Link></li>
            <li><Link href="/lojas" className="transition-colors hover:text-white">Nossas lojas</Link></li>
            <li><Link href="/clube" className="transition-colors hover:text-white">Clube SuperVerde</Link></li>
            <li><Link href="/receitas" className="transition-colors hover:text-white">Receitas e Sugestões do Dia</Link></li>
            <li><Link href="/trabalhe-conosco" className="transition-colors hover:text-white">Trabalhe Conosco</Link></li>
            <li><Link href="/privacidade" className="transition-colors hover:text-white">Política de Privacidade</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">Atendimento</h2>
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
                className="inline-block pt-1 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
              >
                WhatsApp da loja
              </a>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="m-0 text-sm font-bold tracking-wide text-white">Compra tranquila</h2>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <ShieldCheck size={14} className="shrink-0 text-zinc-400" />
              Site seguro
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <Package size={14} className="shrink-0 text-zinc-400" />
              Entrega garantida
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <BadgePercent size={14} className="shrink-0 text-zinc-400" />
              Preço justo
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-zinc-400">
            {isSafeWebUrl(settings.institution.instagram) && (
              <a href={settings.institution.instagram} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                Instagram
              </a>
            )}
            {isSafeWebUrl(settings.institution.facebook) && (
              <a href={settings.institution.facebook} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                Facebook
              </a>
            )}
            {settings.institution.socialLinks
              .filter((link) => isSafeWebUrl(link.url))
              .map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                  {link.name}
                </a>
              ))}
            {isSafeWebUrl(settings.channels.offersGroupUrl) && (
              <a href={settings.channels.offersGroupUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                Ofertas no WhatsApp
              </a>
            )}
            <Link href="/bio" className="transition-colors hover:text-white">
              Links oficiais
            </Link>
          </div>

          {settings.pwa.enabled && (
            <div className="flex flex-wrap gap-2 pt-1">
              {settings.pwa.googlePlay.enabled && isSafeWebUrl(settings.pwa.googlePlay.url) && (
                <a href={settings.pwa.googlePlay.url} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white">
                  Google Play
                </a>
              )}
              {settings.pwa.appStore.enabled && isSafeWebUrl(settings.pwa.appStore.url) && (
                <a href={settings.pwa.appStore.url} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white">
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
          <Link href="/admin" className="inline-flex items-center gap-1 font-medium text-zinc-500 transition-colors hover:text-zinc-300">
            Acesso do gestor <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
