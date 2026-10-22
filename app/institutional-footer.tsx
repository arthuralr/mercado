'use client';

import Link from 'next/link';
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
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <BrandLogo />
          <p className="mb-0 mt-3 text-sm leading-6 text-slate-300">{settings.institution.aboutText}</p>
        </div>
        <div>
          <h2 className="m-0 text-sm font-black">Institucional</h2>
          <ul className="mt-3 space-y-2 p-0 text-sm text-slate-300">
            <li><Link href="/sobre" className="hover:text-white">Quem somos</Link></li>
            <li><Link href="/lojas" className="hover:text-white">Nossas lojas</Link></li>
            <li><Link href="/clube" className="hover:text-white">Clube SuperVerde</Link></li>
            <li><Link href="/receitas" className="hover:text-white">Receitas e Sugestões do Dia</Link></li>
            <li><Link href="/trabalhe-conosco" className="hover:text-white">Trabalhe Conosco</Link></li>
            <li><Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="m-0 text-sm font-black">Atendimento</h2>
          <p className="mb-2 mt-3 text-sm text-slate-300">{settings.institution.address}</p>
          <p className="mb-2 text-sm text-slate-300">{settings.institution.hours}</p>
          <p className="mb-2 text-sm text-slate-300">{settings.institution.phone}</p>
          <a href={`mailto:${settings.institution.email}`} className="break-all text-sm text-slate-300 hover:text-white">{settings.institution.email}</a>
          {settings.channels.whatsappEnabled && <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-bold text-white hover:underline">WhatsApp da loja</a>}
        </div>
        <div>
          <h2 className="m-0 text-sm font-black">Acompanhe</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {isSafeWebUrl(settings.institution.instagram) && <a href={settings.institution.instagram} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800">Instagram</a>}
            {isSafeWebUrl(settings.institution.facebook) && <a href={settings.institution.facebook} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800">Facebook</a>}
            {settings.institution.socialLinks
              .filter((link) => isSafeWebUrl(link.url))
              .map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800">
                  {link.name}
                </a>
              ))}
            {isSafeWebUrl(settings.channels.offersGroupUrl) && <a href={settings.channels.offersGroupUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800">Ofertas no WhatsApp</a>}
            <Link href="/bio" className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800">Links oficiais</Link>
          </div>
          {settings.pwa.enabled && (
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.pwa.googlePlay.enabled && isSafeWebUrl(settings.pwa.googlePlay.url) && (
                <a href={settings.pwa.googlePlay.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200">Google Play</a>
              )}
              {settings.pwa.appStore.enabled && isSafeWebUrl(settings.pwa.appStore.url) && (
                <a href={settings.pwa.appStore.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200">App Store</a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-400">
        <span>{settings.institution.storeName} · Os preços e a disponibilidade podem variar por loja.</span>
        <Link href="/admin" className="text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-300">Acesso do gestor</Link>
      </div>
    </footer>
  );
}
