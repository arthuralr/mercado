'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  FileText,
  Plus,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useSiteSettings } from '../admin-data-provider';
import { revalidateSiteSettings } from '../actions/site-settings';
import {
  defaultSiteSettings,
  isSafeWebUrl,
  SITE_SETTINGS_TABLE,
  type SiteSettings,
} from '@/lib/site-settings';

type ExtraSection = 'settings' | 'submissions' | 'calendar';
type BannerKey = 'secondaryImage' | 'tertiaryImage';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700';
const labelClass = 'block text-sm font-semibold text-slate-700';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-emerald-700"
      />
    </label>
  );
}

export default function AdminExtraPanel({ section }: { section: ExtraSection }) {
  if (section === 'settings') return <SiteSettingsFormGate />;
  if (section === 'submissions') return <SubmissionInbox />;
  return <SeasonalCalendar />;
}

function SiteSettingsFormGate() {
  const { settings, settingsReady } = useSiteSettings();
  if (!settingsReady) return <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Carregando configurações atuais…</p>;
  return <SiteSettingsForm initialSettings={settings} />;
}

function SiteSettingsForm({ initialSettings }: { initialSettings: SiteSettings }) {
  const router = useRouter();
  const { updateSettings } = useSiteSettings();
  const [draft, setDraft] = useState(initialSettings);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.institution.storeName.trim()) {
      setMessage('Informe o nome da loja antes de publicar.');
      return;
    }
    if (
      draft.institution.branches.some(
        (branch) => !branch.name.trim() || !branch.address.trim(),
      )
    ) {
      setMessage('Cada filial precisa ter um nome e um endereço.');
      return;
    }
    if (
      draft.institution.socialLinks.some(
        (link) => !link.name.trim() || !isSafeWebUrl(link.url),
      )
    ) {
      setMessage('Informe o nome de cada rede social e um link HTTP ou HTTPS válido.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabaseBrowser
        .from(SITE_SETTINGS_TABLE)
        .upsert(
          { id: 'principal', dados: draft, atualizado_em: new Date().toISOString() },
          { onConflict: 'id' },
        );
      if (error) {
        setMessage(`Não foi possível salvar as configurações: ${error.message}`);
        return;
      }
      updateSettings(draft);
      window.dispatchEvent(new Event('site-settings-changed'));
      await revalidateSiteSettings().catch(() => undefined);
      router.refresh();
      setMessage('Configurações da Loja publicadas com sucesso.');
    } catch (error) {
      console.error('Falha ao publicar as configurações da loja no Supabase.', error);
      setMessage(
        error instanceof Error
          ? `Não foi possível salvar as configurações: ${error.message}`
          : 'Não foi possível salvar as configurações por um erro inesperado.',
      );
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function uploadBannerFile(
    file: File,
    prefix: string,
    dimensions: { width: number; height: number },
  ): Promise<string | null> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Banner: use apenas JPG, PNG ou WebP.');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('O banner deve ter no máximo 5 MB.');
      return null;
    }
    const bitmap = await createImageBitmap(file);
    if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) {
      setMessage(
        `Dimensão inválida. Esta área exige exatamente ${dimensions.width} × ${dimensions.height}px.`,
      );
      bitmap.close();
      return null;
    }
    bitmap.close();
    const path = `banners/${prefix}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const { data, error } = await supabaseBrowser.storage
      .from('encartes')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setMessage(`Não foi possível enviar o banner: ${error.message}`);
      return null;
    }
    return supabaseBrowser.storage.from('encartes').getPublicUrl(data.path).data.publicUrl;
  }

  async function uploadBanner(
    event: React.ChangeEvent<HTMLInputElement>,
    key: BannerKey,
    dimensions: { width: number; height: number },
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const publicUrl = await uploadBannerFile(file, key, dimensions);
    if (!publicUrl) return;
    setDraft((current) => ({
      ...current,
      banners: { ...current.banners, [key]: publicUrl },
    }));
    setMessage('Banner enviado. Salve as configurações para publicar.');
  }

  function patchCampaignCopy(
    index: number,
    key: keyof SiteSettings['banners']['campaigns'][number],
    value: string,
  ) {
    const campaigns = draft.banners.campaigns.map((campaign, campaignIndex) =>
      campaignIndex === index ? { ...campaign, [key]: value } : campaign,
    );
    const banners = { ...draft.banners, campaigns };
    if (index === 0) {
      banners.mainTitle = campaigns[0].title;
      banners.mainSubtitle = campaigns[0].subtitle;
      banners.mainImage = campaigns[0].image;
    }
    patch('banners', banners);
  }

  async function uploadCampaignImage(
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const campaign = draft.banners.campaigns[index];
    if (!campaign) return;
    const campaignId = campaign.id;
    const image = await uploadBannerFile(file, `campaign-${campaignId}`, {
      width: 1200,
      height: 400,
    });
    if (!image) return;
    setDraft((current) => {
      const campaigns = current.banners.campaigns.map((item) =>
        item.id === campaignId ? { ...item, image } : item,
      );
      return {
        ...current,
        banners: {
          ...current.banners,
          campaigns,
          mainImage: campaigns[0].image,
          mainTitle: campaigns[0].title,
          mainSubtitle: campaigns[0].subtitle,
        },
      };
    });
    setMessage('Imagem enviada. Salve as configurações para publicar.');
  }

  function addCampaign() {
    patch('banners', {
      ...draft.banners,
      campaigns: [
        ...draft.banners.campaigns,
        {
          id: crypto.randomUUID(),
          eyebrow: 'Nova campanha',
          title: 'Título da campanha',
          subtitle: 'Descrição da campanha.',
          button: 'Saiba mais',
          image: draft.banners.campaigns[0].image,
        },
      ],
    });
  }

  function moveCampaign(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.banners.campaigns.length) return;
    const campaigns = [...draft.banners.campaigns];
    [campaigns[index], campaigns[nextIndex]] = [campaigns[nextIndex], campaigns[index]];
    patch('banners', {
      ...draft.banners,
      campaigns,
      mainTitle: campaigns[0].title,
      mainSubtitle: campaigns[0].subtitle,
      mainImage: campaigns[0].image,
    });
  }

  function removeCampaign(index: number) {
    if (draft.banners.campaigns.length <= 1) return;
    const campaigns = draft.banners.campaigns.filter((_, itemIndex) => itemIndex !== index);
    patch('banners', {
      ...draft.banners,
      campaigns,
      mainTitle: campaigns[0].title,
      mainSubtitle: campaigns[0].subtitle,
      mainImage: campaigns[0].image,
    });
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Logo: use apenas JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('O logotipo deve ter no máximo 2 MB.');
      return;
    }

    setLogoUploading(true);
    setMessage('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `logos/logo-${crypto.randomUUID()}-${safeName}`;
      const { data, error } = await supabaseBrowser.storage
        .from('encartes')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        console.error('Falha ao enviar o logotipo para o bucket encartes.', error);
        setMessage(`Não foi possível enviar o logotipo: ${error.message}`);
        return;
      }
      if (!data?.path) {
        throw new Error('O Supabase Storage não retornou o caminho do arquivo enviado.');
      }

      const logoUrl = supabaseBrowser.storage
        .from('encartes')
        .getPublicUrl(data.path).data.publicUrl;
      if (!logoUrl) {
        throw new Error('Não foi possível obter a URL pública do logotipo enviado.');
      }

      const nextDraft: SiteSettings = {
        ...draft,
        brand: { ...draft.brand, logoUrl },
      };
      setDraft(nextDraft);

      const { error: settingsError } = await supabaseBrowser
        .from(SITE_SETTINGS_TABLE)
        .upsert(
          {
            id: 'principal',
            dados: nextDraft,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
      if (settingsError) {
        console.error('Logotipo enviado, mas não foi possível gravar a URL nas configurações da loja.', settingsError);
        setMessage(
          `Logotipo enviado, mas não foi possível salvar o link nas configurações: ${settingsError.message}. Use “Salvar e publicar configurações” para tentar novamente.`,
        );
        return;
      }

      updateSettings(nextDraft);
      window.dispatchEvent(new Event('site-settings-changed'));
      await revalidateSiteSettings().catch(() => undefined);
      router.refresh();
      setMessage('Logotipo enviado e publicado nas configurações da loja.');
    } catch (error) {
      console.error('Falha inesperada ao enviar ou salvar o logotipo.', error);
      setMessage(
        error instanceof Error
          ? `Não foi possível concluir o envio do logotipo: ${error.message}`
          : 'Não foi possível concluir o envio do logotipo por um erro inesperado.',
      );
    } finally {
      setLogoUploading(false);
    }
  }

  function updateBranch(
    index: number,
    update: Partial<SiteSettings['institution']['branches'][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      institution: {
        ...current.institution,
        branches: current.institution.branches.map((branch, branchIndex) =>
          branchIndex === index ? { ...branch, ...update } : branch,
        ),
        ...(index === 0 && update.address !== undefined ? { address: update.address } : {}),
        ...(index === 0 && update.city !== undefined ? { city: update.city } : {}),
        ...(index === 0 && update.neighborhood !== undefined
          ? { neighborhood: update.neighborhood }
          : {}),
        ...(index === 0 && update.phone !== undefined ? { phone: update.phone } : {}),
        ...(index === 0 && update.email !== undefined ? { email: update.email } : {}),
        ...(index === 0 && update.hours !== undefined ? { hours: update.hours } : {}),
      },
    }));
  }

  function removeBranch(index: number) {
    const branches = draft.institution.branches.filter(
      (_, branchIndex) => branchIndex !== index,
    );
    const primaryBranch = branches[0];
    patch('institution', {
      ...draft.institution,
      branches,
      ...(index === 0 && primaryBranch
        ? {
            address: primaryBranch.address,
            city: primaryBranch.city ?? '',
            neighborhood: primaryBranch.neighborhood ?? '',
            phone: primaryBranch.phone ?? '',
            email: primaryBranch.email ?? '',
            hours: primaryBranch.hours ?? '',
          }
        : {}),
    });
  }

  const bioLinks = draft.bioLinks;

  return (
    <form onSubmit={saveSettings} className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-lg font-black">Identidade visual</h2>
        <div className="flex flex-wrap items-center gap-4">
          {draft.brand.logoUrl ? (
            <Image
              src={draft.brand.logoUrl}
              alt="Prévia do logotipo"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-xl border border-slate-200 object-contain p-2"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
              Sem logo
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <label className={labelClass}>Logotipo do mercado<input type="file" accept="image/jpeg,image/png,image/webp" disabled={logoUploading} onChange={(event) => void uploadLogo(event)} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 disabled:opacity-60`} /></label>
            {logoUploading && <p role="status" className="m-0 text-xs font-semibold text-emerald-800">Enviando e publicando logotipo…</p>}
            <p className="m-0 text-xs text-slate-500">JPG, PNG ou WebP até 2 MB. Ao publicar, o cabeçalho e o rodapé serão atualizados.</p>
            {draft.brand.logoUrl && <button type="button" onClick={() => patch('brand', { ...draft.brand, logoUrl: '' })} className="text-xs font-semibold text-slate-600 underline">Remover logotipo</button>}
          </div>
        </div>
        <label className={labelClass}>
          Nome exibido no site
          <input
            value={draft.institution.storeName}
            onChange={(event) => {
              const nextStoreName = event.target.value;
              const prevStoreName = draft.institution.storeName;
              const defaultBranchName = defaultSiteSettings.institution.branches[0].name;
              const branches = draft.institution.branches.map((branch, index) =>
                index === 0 &&
                (branch.name === defaultBranchName ||
                  branch.name === prevStoreName ||
                  branch.name === defaultSiteSettings.institution.storeName)
                  ? { ...branch, name: nextStoreName }
                  : branch,
              );
              patch('institution', {
                ...draft.institution,
                storeName: nextStoreName,
                branches,
              });
            }}
            className={inputClass}
            maxLength={80}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3`}>
            <span>Cor principal<br /><span className="text-xs font-normal text-slate-500">Botões e destaques</span></span>
            <input type="color" value={draft.brand.primaryColor} onChange={(event) => patch('brand', { ...draft.brand, primaryColor: event.target.value })} className="h-11 w-14 cursor-pointer rounded border-0 bg-transparent p-1" />
          </label>
          <label className={`${labelClass} flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3`}>
            <span>Cor secundária<br /><span className="text-xs font-normal text-slate-500">Acentos e ícones</span></span>
            <input type="color" value={draft.brand.secondaryColor} onChange={(event) => patch('brand', { ...draft.brand, secondaryColor: event.target.value })} className="h-11 w-14 cursor-pointer rounded border-0 bg-transparent p-1" />
          </label>
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2"><Settings2 className="text-emerald-700" size={19} /><h2 className="m-0 text-lg font-black">Vendas e pagamentos</h2></div>
        <Toggle label="Habilitar compras online" checked={draft.commerceEnabled} onChange={(value) => patch('commerceEnabled', value)} />
        <p className="m-0 text-xs text-slate-500">Desligado, o site continua como vitrine e panfleto de ofertas, sem adicionar produtos nem finalizar pedidos.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Aceitar Pix" checked={draft.payments.pix.enabled} onChange={(enabled) => patch('payments', { ...draft.payments, pix: { ...draft.payments.pix, enabled } })} />
          <Toggle label="Cartão na entrega (maquininha)" checked={draft.payments.cardOnDelivery} onChange={(cardOnDelivery) => patch('payments', { ...draft.payments, cardOnDelivery })} />
          <Toggle label="Dinheiro e troco" checked={draft.payments.cash} onChange={(cash) => patch('payments', { ...draft.payments, cash })} />
          <Toggle label="Vale-alimentação" checked={draft.payments.foodVoucher} onChange={(foodVoucher) => patch('payments', { ...draft.payments, foodVoucher })} />
        </div>
        {draft.payments.pix.enabled && <label className={labelClass}>Chave Pix<input value={draft.payments.pix.key} onChange={(event) => patch('payments', { ...draft.payments, pix: { ...draft.payments.pix, key: event.target.value } })} className={inputClass} /></label>}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-lg font-black">PWA e lojas de aplicativos</h2>
        <Toggle label="Exibir opções para instalar/baixar o aplicativo" checked={draft.pwa.enabled} onChange={(enabled) => patch('pwa', { ...draft.pwa, enabled })} />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <Toggle label="Exibir Google Play" checked={draft.pwa.googlePlay.enabled} onChange={(enabled) => patch('pwa', { ...draft.pwa, googlePlay: { ...draft.pwa.googlePlay, enabled } })} />
            <label className={labelClass}>Link direto da Play Store<input type="url" value={draft.pwa.googlePlay.url} onChange={(event) => patch('pwa', { ...draft.pwa, googlePlay: { ...draft.pwa.googlePlay, url: event.target.value } })} className={inputClass} /></label>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <Toggle label="Exibir Apple App Store" checked={draft.pwa.appStore.enabled} onChange={(enabled) => patch('pwa', { ...draft.pwa, appStore: { ...draft.pwa.appStore, enabled } })} />
            <label className={labelClass}>Link direto da App Store<input type="url" value={draft.pwa.appStore.url} onChange={(event) => patch('pwa', { ...draft.pwa, appStore: { ...draft.pwa.appStore, url: event.target.value } })} className={inputClass} /></label>
          </div>
        </div>
        <p className="m-0 text-xs text-slate-500">O botão PWA aparece quando o navegador identifica que o site pode ser instalado. Os links das lojas são opcionais.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-lg font-black">Canais e programas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Botão de WhatsApp" checked={draft.channels.whatsappEnabled} onChange={(whatsappEnabled) => patch('channels', { ...draft.channels, whatsappEnabled })} />
          <Toggle label="Botão do iFood" checked={draft.channels.ifoodEnabled} onChange={(ifoodEnabled) => patch('channels', { ...draft.channels, ifoodEnabled })} />
          <Toggle label="Pré-cadastro Cartão da Loja" checked={draft.features.cardApplicationsEnabled} onChange={(cardApplicationsEnabled) => patch('features', { ...draft.features, cardApplicationsEnabled })} />
          <Toggle label="Clube SuperVerde" checked={draft.features.clubEnabled} onChange={(clubEnabled) => patch('features', { ...draft.features, clubEnabled })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>WhatsApp com código do país<input value={draft.channels.whatsappNumber} onChange={(event) => patch('channels', { ...draft.channels, whatsappNumber: event.target.value })} className={inputClass} placeholder="5511999999999" /></label>
          <label className={labelClass}>URL da loja oficial no iFood<input type="url" value={draft.channels.ifoodUrl} onChange={(event) => patch('channels', { ...draft.channels, ifoodUrl: event.target.value })} className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-2`}>Link do grupo oficial de ofertas no WhatsApp<input type="url" value={draft.channels.offersGroupUrl} onChange={(event) => patch('channels', { ...draft.channels, offersGroupUrl: event.target.value })} className={inputClass} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-lg font-black">Configurações da Loja</h2>
        <Toggle label="Exibir faixa de aviso no topo" checked={draft.topbar.enabled} onChange={(enabled) => patch('topbar', { ...draft.topbar, enabled })} />
        <label className={labelClass}>Texto do aviso<input value={draft.topbar.text} onChange={(event) => patch('topbar', { ...draft.topbar, text: event.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Texto institucional / Quem somos<textarea rows={4} value={draft.institution.aboutText} onChange={(event) => patch('institution', { ...draft.institution, aboutText: event.target.value })} className={inputClass} maxLength={2000} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Endereço completo<input value={draft.institution.address} onChange={(event) => patch('institution', { ...draft.institution, address: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Cidade (SEO local)<input value={draft.institution.city} onChange={(event) => patch('institution', { ...draft.institution, city: event.target.value })} className={inputClass} maxLength={100} placeholder="Ex.: Campinas" /></label>
          <label className={labelClass}>Bairro (SEO local)<input value={draft.institution.neighborhood} onChange={(event) => patch('institution', { ...draft.institution, neighborhood: event.target.value })} className={inputClass} maxLength={100} placeholder="Ex.: Centro" /></label>
          <label className={labelClass}>Telefone de atendimento<input value={draft.institution.phone} onChange={(event) => patch('institution', { ...draft.institution, phone: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>E-mail<input type="email" value={draft.institution.email} onChange={(event) => patch('institution', { ...draft.institution, email: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Horários de funcionamento<input value={draft.institution.hours} onChange={(event) => patch('institution', { ...draft.institution, hours: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Facebook<input type="url" value={draft.institution.facebook} onChange={(event) => patch('institution', { ...draft.institution, facebook: event.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Instagram<input type="url" value={draft.institution.instagram} onChange={(event) => patch('institution', { ...draft.institution, instagram: event.target.value })} className={inputClass} /></label>
        </div>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-black">Lojas e filiais</h3>
            <button type="button" onClick={() => patch('institution', { ...draft.institution, branches: [...draft.institution.branches, { id: crypto.randomUUID(), name: '', address: '', city: '', neighborhood: '', phone: '', email: '', hours: '' }] })} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">Adicionar filial</button>
          </div>
          {draft.institution.branches.map((branch, index) => (
            <div key={branch.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>Nome da loja<input required maxLength={100} value={branch.name} onChange={(event) => updateBranch(index, { name: event.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Endereço completo<input required maxLength={300} value={branch.address} onChange={(event) => updateBranch(index, { address: event.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Cidade<input value={branch.city ?? ''} onChange={(event) => updateBranch(index, { city: event.target.value })} className={inputClass} maxLength={100} /></label>
              <label className={labelClass}>Bairro<input value={branch.neighborhood ?? ''} onChange={(event) => updateBranch(index, { neighborhood: event.target.value })} className={inputClass} maxLength={100} /></label>
              <label className={labelClass}>Telefone da filial<input value={branch.phone ?? ''} onChange={(event) => updateBranch(index, { phone: event.target.value })} className={inputClass} /></label>
              <label className={labelClass}>E-mail da filial<input type="email" value={branch.email ?? ''} onChange={(event) => updateBranch(index, { email: event.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Horários da filial<input value={branch.hours ?? ''} onChange={(event) => updateBranch(index, { hours: event.target.value })} className={inputClass} /></label>
              <button type="button" disabled={draft.institution.branches.length === 1} onClick={() => removeBranch(index)} className="self-end rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 underline disabled:opacity-40">Remover filial</button>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="m-0 text-sm font-black">Outras redes sociais</h3>
              <p className="mb-0 mt-1 text-xs text-slate-500">Adicione canais além de Facebook e Instagram.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                patch('institution', {
                  ...draft.institution,
                  socialLinks: [
                    ...draft.institution.socialLinks,
                    { id: crypto.randomUUID(), name: '', url: '' },
                  ],
                })
              }
              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800"
            >
              Adicionar rede social
            </button>
          </div>
          {draft.institution.socialLinks.map((social, index) => (
            <div key={social.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <label className={labelClass}>
                Rede social
                <input
                  required
                  maxLength={40}
                  value={social.name}
                  onChange={(event) =>
                    patch('institution', {
                      ...draft.institution,
                      socialLinks: draft.institution.socialLinks.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    })
                  }
                  className={inputClass}
                  placeholder="Ex.: TikTok"
                />
              </label>
              <label className={labelClass}>
                Link
                <input
                  required
                  type="url"
                  value={social.url}
                  onChange={(event) =>
                    patch('institution', {
                      ...draft.institution,
                      socialLinks: draft.institution.socialLinks.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, url: event.target.value } : item,
                      ),
                    })
                  }
                  className={inputClass}
                  placeholder="https://..."
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  patch('institution', {
                    ...draft.institution,
                    socialLinks: draft.institution.socialLinks.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
                className="rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 underline"
              >
                Remover rede
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-black">Carrossel de banners</h2>
          <button type="button" onClick={addCampaign} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">
            <Plus size={15} />Adicionar banner
          </button>
        </div>
        <p className="m-0 text-sm text-slate-600">Cadastre, edite e ordene os slides exibidos na página inicial. Imagens: exatamente <strong>1200 × 400 px</strong>, JPG/PNG/WebP até 5 MB. Os dois slots de ofertas menores ficam abaixo do carrossel. As alterações são publicadas ao salvar as configurações.</p>
        {draft.banners.campaigns.map((campaign, index) => (
          <fieldset key={campaign.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">Banner {index + 1}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-slate-500">{campaign.image || 'Nenhuma imagem selecionada'}</span>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">
                  <Upload size={15} />Enviar imagem
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadCampaignImage(event, index)} />
                </label>
                <button type="button" aria-label={`Mover banner ${index + 1} para cima`} disabled={index === 0} onClick={() => moveCampaign(index, -1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-40">
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label={`Mover banner ${index + 1} para baixo`} disabled={index === draft.banners.campaigns.length - 1} onClick={() => moveCampaign(index, 1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-40">
                  <ArrowDown size={16} />
                </button>
                <button type="button" aria-label={`Remover banner ${index + 1}`} disabled={draft.banners.campaigns.length === 1} onClick={() => removeCampaign(index)} className="rounded-lg border border-rose-200 p-2 text-rose-700 disabled:opacity-40">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <label className={labelClass}>
              Chamada
              <input
                value={campaign.eyebrow}
                onChange={(event) => patchCampaignCopy(index, 'eyebrow', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Título
              <input
                value={campaign.title}
                onChange={(event) => patchCampaignCopy(index, 'title', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Subtítulo
              <textarea
                rows={2}
                value={campaign.subtitle}
                onChange={(event) => patchCampaignCopy(index, 'subtitle', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Texto do botão
              <input
                value={campaign.button}
                onChange={(event) => patchCampaignCopy(index, 'button', event.target.value)}
                className={inputClass}
              />
            </label>
          </fieldset>
        ))}
        {([
          ['secondaryImage', 'Slot menor 1 (600 × 300 px)', { width: 600, height: 300 }],
          ['tertiaryImage', 'Slot menor 2 (600 × 300 px)', { width: 600, height: 300 }],
        ] as const).map(([key, label, dimensions]) => (
          <label key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
            <span className="min-w-0"><strong>{label}</strong><span className="block truncate text-xs text-slate-500">{draft.banners[key] || 'Nenhum arquivo publicado'}</span></span>
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white"><Upload size={15} />Enviar imagem<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadBanner(event, key, dimensions)} /></span>
          </label>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-black">Links da página /bio</h2>
          <button type="button" onClick={() => patch('bioLinks', [...bioLinks, { label: '', url: '', enabled: true }])} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">Adicionar link</button>
        </div>
        {bioLinks.map((link, index) => (
          <div key={`${link.label}-${index}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
            <label className={labelClass}>Texto<input value={link.label} onChange={(event) => patch('bioLinks', bioLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className={inputClass} /></label>
            <label className={labelClass}>Link<input value={link.url} onChange={(event) => patch('bioLinks', bioLinks.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} className={inputClass} placeholder="/panfleto-de-ofertas ou https://..." /></label>
            <Toggle label="Exibir" checked={link.enabled} onChange={(enabled) => patch('bioLinks', bioLinks.map((item, itemIndex) => itemIndex === index ? { ...item, enabled } : item))} />
            <button type="button" disabled={bioLinks.length === 1} onClick={() => patch('bioLinks', bioLinks.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Remover</button>
          </div>
        ))}
      </section>

      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white disabled:opacity-60"><Check size={17} />{saving ? 'Salvando...' : 'Salvar e publicar configurações'}</button>
    </form>
  );
}

interface InboxEntry {
  type: string;
  id: string;
  createdAt: string;
  fields: Record<string, string | number | null>;
  fileUrl?: string;
}

function SubmissionInbox() {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabaseBrowser.from('solicitacoes_cartao').select('*').order('criado_em', { ascending: false }).limit(100),
      supabaseBrowser.from('candidaturas').select('*').order('criado_em', { ascending: false }).limit(100),
      supabaseBrowser.from('clube_cadastros').select('*').order('criado_em', { ascending: false }).limit(100),
    ]).then(async ([cards, applications, club]) => {
      const failure = cards.error ?? applications.error ?? club.error;
      if (failure) {
        if (active) setError(`Não foi possível carregar os formulários recebidos: ${failure.message}`);
        return;
      }
      const rows: InboxEntry[] = [
        ...(cards.data ?? []).map((row) => ({ type: 'Cartão da Loja', id: row.id, createdAt: row.criado_em, fields: { Nome: row.nome, CPF: row.cpf, Telefone: row.telefone, 'E-mail': row.email, 'Data de nascimento': row.data_nascimento } })),
        ...(applications.data ?? []).map((row) => ({ type: 'Trabalhe Conosco', id: row.id, createdAt: row.criado_em, fields: { Nome: row.nome, Contato: row.contato, 'Cargo desejado': row.cargo_desejado, Currículo: row.curriculo_texto, 'Arquivo enviado': row.arquivo_path } })),
        ...(club.data ?? []).map((row) => ({ type: 'Clube SuperVerde', id: row.id, createdAt: row.criado_em, fields: { Nome: row.nome, Telefone: row.telefone, 'E-mail': row.email } })),
      ];
      for (const row of rows) {
        const filePath = row.fields['Arquivo enviado'];
        if (typeof filePath !== 'string') continue;
        const { data, error: signedUrlError } = await supabaseBrowser.storage.from('curriculos').createSignedUrl(filePath, 300);
        if (signedUrlError) {
          console.error('Não foi possível gerar link temporário para o currículo.', signedUrlError);
          continue;
        }
        row.fileUrl = data.signedUrl;
      }
      if (active) setEntries(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Erro ao consultar os formulários.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-lg font-black">Solicitações recebidas</h2>
        <p className="mb-0 mt-1 text-sm text-slate-500">Dados pessoais são exibidos somente para gestores autorizados no Supabase.</p>
      </div>
      {loading && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Carregando solicitações…</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {!loading && !error && entries.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum cadastro recebido até o momento.</p>}
      {entries.map((entry) => (
        <article key={`${entry.type}-${entry.id}`} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 flex items-center gap-2 font-black"><FileText size={17} className="text-emerald-700" />{entry.type}</h3>
            <time className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('pt-BR')}</time>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(entry.fields).filter(([key, value]) => key !== 'Arquivo enviado' && value).map(([key, value]) => (
              <div key={key} className="min-w-0"><dt className="text-xs font-bold uppercase text-slate-500">{key}</dt><dd className="m-0 whitespace-pre-wrap break-words text-sm text-slate-800">{String(value)}</dd></div>
            ))}
          </dl>
          {entry.fileUrl && <a href={entry.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100">Abrir currículo (link temporário)</a>}
        </article>
      ))}
    </section>
  );
}

function SeasonalCalendar() {
  const year = new Date().getFullYear();
  const easter = easterSunday(year);
  const dates: Array<[Date, string, string]> = [
    [new Date(year, 0, 1), 'Confraternização Universal', 'Verão: kits para praia, frutas frescas e hidratação.'],
    [shiftDate(easter, -47), 'Carnaval (terça-feira, referência)', 'Planeje abastecimento, horários e combos para encontros.'],
    [shiftDate(easter, -2), 'Paixão de Cristo', 'Divulgue horários especiais e ofertas para refeições em família.'],
    [easter, 'Páscoa', 'Destaque chocolates, peixes, ovos e itens para o almoço.'],
    [new Date(year, 3, 21), 'Tiradentes', 'Feriado: combos práticos para viagem e churrasco.'],
    [new Date(year, 4, 1), 'Dia do Trabalho', 'Cestas de café da manhã e ofertas para o almoço em família.'],
    [nthWeekday(year, 4, 0, 2), 'Dia das Mães', 'Planeje flores, café da manhã e sugestões para o almoço.'],
    [new Date(year, 5, 12), 'Dia dos Namorados', 'Jantar especial: massas, vinhos e sobremesas.'],
    [new Date(year, 5, 24), 'Festa Junina', 'Receitas e ilha temática com milho, amendoim e doces.'],
    [shiftDate(easter, 60), 'Corpus Christi (referência)', 'Confira o calendário municipal e comunique o expediente.'],
    [nthWeekday(year, 7, 0, 2), 'Dia dos Pais', 'Churrasco e presentes gastronômicos.'],
    [new Date(year, 8, 7), 'Independência do Brasil', 'Planeje ofertas para o feriado e divulgue horários.'],
    [new Date(year, 9, 12), 'Nossa Senhora Aparecida / Dia das Crianças', 'Kits de lanche, doces e atividades em família.'],
    [new Date(year, 10, 2), 'Finados', 'Comunique horários especiais com antecedência.'],
    [new Date(year, 10, 15), 'Proclamação da República', 'Planeje a operação de feriado e o abastecimento.'],
    [new Date(year, 10, 20), 'Consciência Negra', 'Verifique regras locais e informe funcionamento.'],
    [nthWeekday(year, 10, 5, 4), 'Black Friday', 'Ofertas com estoque, validade e preço conferidos.'],
    [new Date(year, 11, 25), 'Natal', 'Encomendas, ceia, aves, frutas e horários especiais.'],
    [new Date(year, 11, 31), 'Véspera de Ano Novo', 'Kits para celebração e comunicação do horário de fechamento.'],
  ];
  dates.sort(([first], [second]) => first.getTime() - second.getTime());

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 flex items-center gap-2 text-lg font-black"><CalendarDays size={20} className="text-emerald-700" />Calendário sazonal {year}</h2>
        <p className="mb-0 mt-1 text-sm text-slate-500">Datas nacionais e sugestões para planejar campanhas, abastecimento e postagens. Confirme feriados municipais e datas móveis localmente.</p>
      </div>
      <ol className="space-y-3">
        {dates.map(([date, title, idea]) => (
          <li key={`${date.toISOString()}-${title}`} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <time dateTime={date.toISOString().slice(0, 10)} className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-black text-emerald-800">{date.toLocaleDateString('pt-BR')}</time>
            <div><h3 className="m-0 font-black">{title}</h3><p className="mb-0 mt-1 text-sm text-slate-600">{idea}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function shiftDate(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (occurrence - 1) * 7);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
