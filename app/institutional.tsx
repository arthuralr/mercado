'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock3, Phone, ArrowRight, Leaf, Smartphone } from 'lucide-react';
import { ShopHeader } from './shop-components';
import { useSiteSettings } from './admin-data-provider';
import { CardRequestForm, ClubSignupForm, JobApplicationForm } from './customer-forms';
import {
  DEFAULT_ABOUT_TEXT,
  DEFAULT_ABOUT_TITLE,
  DEFAULT_ABOUT_VALUES,
  getStoreUnits,
  getStoreWhatsappUrl,
  isSafeSiteLink,
  isSafeWebUrl,
} from '@/lib/site-settings';
import { OfficialSocialLinks, hasConfiguredSocialLinks } from './social-links';
import { openPwaInstallPrompt } from './pwa-install-banner';

const pageClass = 'mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8';

function PageFrame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  return (
    <main className="min-h-screen bg-[#f7f8f4]">
      <ShopHeader />
      <div className={pageClass}>
        <Link href="/" className="text-sm font-bold text-emerald-800 hover:underline">← Início</Link>
        <header className="my-6 rounded-3xl bg-emerald-900 p-7 text-white sm:p-10">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-200">{storeName}</p>
          <h1 className="m-0 text-3xl font-black sm:text-4xl">{title}</h1>
          <p className="mb-0 mt-3 max-w-3xl text-sm leading-6 text-emerald-100 sm:text-base">{intro}</p>
        </header>
        <div className="space-y-5">{children}</div>
      </div>
    </main>
  );
}

export function AboutPage() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const aboutTitle = settings.institution.aboutTitle?.trim() || DEFAULT_ABOUT_TITLE;
  const rawAboutText = settings.institution.aboutText?.trim() || DEFAULT_ABOUT_TEXT;
  const paragraphs = rawAboutText
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const aboutValues =
    Array.isArray(settings.institution.aboutValues) &&
    settings.institution.aboutValues.length > 0
      ? settings.institution.aboutValues
      : DEFAULT_ABOUT_VALUES;

  return (
    <PageFrame title="Quem somos" intro={`Conheça a história, os valores e a proposta de ${storeName}.`}>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 leading-7 text-slate-700">
        <div className="mb-4 flex items-center gap-3 text-emerald-800">
          <Leaf size={24} className="shrink-0" />
          <strong>{aboutTitle}</strong>
        </div>
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="m-0 leading-7 text-slate-700">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {aboutValues.map((pillar, index) => (
          <article key={`${pillar.title}-${index}`} className="rounded-2xl border border-slate-200/70 bg-white p-5">
            <h2 className="m-0 text-lg font-black text-emerald-900">{pillar.title}</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
          </article>
        ))}
      </section>
      {hasConfiguredSocialLinks(settings) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="m-0 text-lg font-black text-slate-900">
            Acompanhe {storeName} nas redes sociais
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Siga nossos canais oficiais para conferir ofertas do dia, novidades e bastidores da loja.
          </p>
          <OfficialSocialLinks variant="pills" />
        </section>
      )}
    </PageFrame>
  );
}

export function StoresPage() {
  const { settings } = useSiteSettings();
  const units = getStoreUnits(settings);
  return (
    <PageFrame title="Nossas lojas e filiais" intro="Consulte o endereço da Loja Matriz e de nossas filiais para planejar sua visita. Confirme os horários especiais antes de feriados.">
      {units.map((branch) => {
        const query = encodeURIComponent(branch.address);
        const phone = branch.phone || settings.institution.phone;
        const email = branch.email || settings.institution.email;
        const hours = branch.hours || settings.institution.hours;
        return (
          <section
            key={branch.id}
            className={`rounded-2xl border bg-white p-6 ${
              branch.isHeadquarters
                ? 'border-emerald-300 ring-1 ring-emerald-500/20'
                : 'border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="m-0 text-xl font-black text-slate-900">{branch.name}</h2>
              {branch.isHeadquarters && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                  Loja Matriz
                </span>
              )}
            </div>
            <p className="mb-3 mt-4 flex items-start gap-2 text-sm text-slate-700"><MapPin size={18} className="mt-0.5 shrink-0 text-emerald-700" />{branch.address}</p>
            <p className="mb-3 flex items-center gap-2 text-sm text-slate-700"><Clock3 size={18} className="text-emerald-700" />{hours}</p>
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-700"><Phone size={18} className="text-emerald-700" />{phone}</p>
            <a href={`mailto:${email}`} className="mb-5 inline-block break-all text-sm text-slate-700 hover:underline">{email}</a>
            <div className="grid gap-3 sm:grid-cols-2">
              <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 px-4 py-3 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50">Abrir mapa no Google Maps</a>
              <a href={`https://waze.com/ul?q=${query}&navigate=yes`} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 px-4 py-3 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50">Traçar rota no Waze</a>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <iframe title={`Mapa ilustrativo ${branch.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${query}&output=embed`} className="h-72 w-full border-0" />
            </div>
            <p className="mb-0 mt-2 text-xs text-slate-500">Mapa ilustrativo baseado no endereço cadastrado pelo gestor. Confirme a localização antes de sair.</p>
          </section>
        );
      })}
    </PageFrame>
  );
}

export function ClubPage() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  return (
    <PageFrame title={`Clube ${storeName} de Descontos`} intro={`Receba novidades e ofertas selecionadas de ${storeName}. Faça seu pré-cadastro para demonstrar interesse no clube.`}>
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-sm leading-6 text-emerald-950">
        <h2 className="m-0 text-xl font-black">Vantagens para acompanhar</h2>
        <p className="mb-0 mt-2">Com o Clube {storeName}, você pode receber comunicações sobre promoções, novidades e campanhas da loja. A participação e a disponibilidade das ofertas seguem as regras informadas pela equipe e podem variar por filial e período.</p>
      </section>
      <ClubSignupForm />
      {isSafeWebUrl(settings.channels.offersGroupUrl) && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="m-0 text-lg font-black">Receba ofertas no WhatsApp</h2><p className="mb-3 mt-2 text-sm text-slate-600">Entre no grupo oficial para acompanhar os avisos. A participação no grupo é opcional.</p><a href={settings.channels.offersGroupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white">Entrar no grupo de ofertas <ArrowRight size={16} /></a></section>}
      <p className="text-xs leading-5 text-slate-500">Ao enviar seus dados, você concorda com o uso para esta finalidade. Consulte a <Link href="/privacidade" className="font-bold text-emerald-800 underline">Política de Privacidade</Link>.</p>
    </PageFrame>
  );
}

export function CardPageView() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  return (
    <PageFrame
      title={`Cartão ${storeName}`}
      intro={`Preencha um pré-cadastro para que a equipe de ${storeName} possa entrar em contato. O envio não representa aprovação de crédito.`}
    >
      <CardRequestForm />
    </PageFrame>
  );
}

export function PrivacyPage() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  return (
    <PageFrame title="Política de Privacidade" intro={`Informações sobre o tratamento de dados pessoais nos canais digitais de ${storeName}, em linguagem clara e alinhada à LGPD.`}>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-700">
        <h2 className="m-0 text-xl font-black text-slate-900">1. Dados que podem ser tratados</h2>
        <p>Podemos tratar dados de cadastro e contato, informações necessárias para pedidos, conteúdo de currículos e solicitações enviados voluntariamente, além de métricas técnicas básicas de visita. Dados de pagamento não são processados neste site.</p>
        <h2 className="m-0 text-xl font-black text-slate-900">2. Finalidades</h2>
        <p>Os dados são utilizados para responder solicitações, registrar pedidos, administrar listas vinculadas à conta, avaliar candidaturas, gerenciar pré-cadastros e melhorar o funcionamento dos canais. O tratamento ocorre conforme a finalidade de cada formulário e as bases legais aplicáveis.</p>
        <h2 className="m-0 text-xl font-black text-slate-900">3. Compartilhamento e segurança</h2>
        <p>O serviço utiliza infraestrutura do Supabase para autenticação e armazenamento. Currículos e informações de pedidos são privados e acessíveis somente às pessoas autorizadas para a finalidade. Não publique informações sensíveis em campos de texto livre.</p>
        <h2 className="m-0 text-xl font-black text-slate-900">4. Retenção e direitos</h2>
        <p>Os dados são mantidos pelo período necessário para atender às finalidades e obrigações aplicáveis. Você pode solicitar confirmação, acesso, correção, anonimização ou exclusão quando cabível, bem como esclarecimentos sobre o tratamento.</p>
        <h2 className="m-0 text-xl font-black text-slate-900">5. Contato de privacidade</h2>
        <p className="mb-0">Para exercer seus direitos ou tirar dúvidas, contate <a className="font-bold text-emerald-800 underline" href={`mailto:${settings.institution.email}`}>{settings.institution.email}</a> ou <a className="font-bold text-emerald-800 underline" href={`tel:${settings.institution.phone.replace(/\D/g, '')}`}>{settings.institution.phone}</a>. O responsável pela loja deve revisar e complementar este aviso com sua razão social, endereço legal e canal do encarregado antes da publicação definitiva.</p>
      </section>
      <p className="text-xs text-slate-500">Texto-base do template; revise juridicamente antes de usar como política definitiva.</p>
    </PageFrame>
  );
}

export function BioPage() {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  const wa = getStoreWhatsappUrl(settings);
  const links = settings.bioLinks.filter((item) =>
    item.enabled &&
    item.label &&
    (item.label.toLowerCase().includes('whatsapp') && !item.url
      ? Boolean(wa)
      : isSafeSiteLink(item.url)),
  );
  return (
    <main className="flex min-h-screen justify-center bg-[radial-gradient(ellipse_at_top,_#d1fae5,_#f7f8f4_48%)] px-4 py-8">
      <section className="my-auto w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-6 text-center shadow-2xl backdrop-blur sm:p-8">
        {settings.brand.logoUrl ? (
          <Image
            src={settings.brand.logoUrl}
            alt={storeName}
            width={80}
            height={80}
            unoptimized
            className="mx-auto h-20 w-20 rounded-3xl border border-slate-100 bg-white object-contain p-2 shadow-lg"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-800 text-white shadow-lg"><Leaf size={38} /></div>
        )}
        <p className="mb-1 mt-5 text-2xl font-black text-emerald-950">{storeName}</p>
        <p className="mb-6 mt-0 text-sm text-slate-500">Mercado fresco, do seu jeito.</p>
        <nav aria-label={`Links ${storeName}`} className="space-y-3">
          {links.map((link) => {
            const href = link.label.toLowerCase().includes('whatsapp') && !link.url ? wa : link.url;
            return <a key={`${link.label}-${link.url}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className="block rounded-2xl bg-emerald-800 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">{link.label}</a>;
          })}
          {settings.channels.ifoodEnabled && isSafeWebUrl(settings.channels.ifoodUrl) && <a href={settings.channels.ifoodUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm font-black text-orange-900">Peça pelo iFood</a>}
          {settings.pwa.enabled && (
            <button
              type="button"
              onClick={openPwaInstallPrompt}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-50 px-5 py-3.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-100"
            >
              <Smartphone size={18} className="text-emerald-800" />
              <span>Instalar o App {storeName} no telemóvel</span>
            </button>
          )}
          {hasConfiguredSocialLinks(settings) && (
            <div className="pt-2">
              <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-slate-500">
                Redes Sociais Oficiais
              </p>
              <OfficialSocialLinks variant="bio" />
            </div>
          )}
        </nav>
        <Link href="/" className="mt-6 inline-block text-xs font-bold text-emerald-800 hover:underline">Visitar a loja online</Link>
      </section>
    </main>
  );
}

export function CareerPage() {
  const { settings } = useSiteSettings();
  return (
    <PageFrame title="Trabalhe Conosco" intro="Quer fazer parte de uma equipe que valoriza o atendimento, o cuidado e a colaboração? Envie seu currículo para avaliação.">
      <section className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-600">
        <h2 className="m-0 text-lg font-black text-slate-900">Oportunidades</h2>
        <p className="mb-0 mt-2">Recebemos candidaturas para diferentes áreas da operação, como atendimento, reposição, caixa, açougue, padaria, hortifrúti e logística. Informe a função de seu interesse e um meio de contato atualizado. O envio não garante contratação; a equipe entrará em contato caso surja uma oportunidade compatível.</p>
      </section>
      <JobApplicationForm />
      <p className="text-xs text-slate-500">Dúvidas sobre candidatura: {settings.institution.email} · <Link href="/privacidade" className="font-bold text-emerald-800 underline">uso dos dados do currículo</Link>.</p>
    </PageFrame>
  );
}
