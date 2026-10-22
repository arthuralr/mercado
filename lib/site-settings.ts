export const SITE_SETTINGS_TABLE = 'configuracoes_site';

export interface SiteSettings {
  brand: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
  };
  commerceEnabled: boolean;
  payments: {
    pix: { enabled: boolean; key: string };
    cardOnDelivery: boolean;
    cash: boolean;
    foodVoucher: boolean;
  };
  pwa: {
    enabled: boolean;
    googlePlay: { enabled: boolean; url: string };
    appStore: { enabled: boolean; url: string };
  };
  channels: {
    whatsappEnabled: boolean;
    whatsappNumber: string;
    ifoodEnabled: boolean;
    ifoodUrl: string;
    offersGroupUrl: string;
  };
  features: {
    cardApplicationsEnabled: boolean;
    clubEnabled: boolean;
  };
  topbar: { enabled: boolean; text: string };
  institution: {
    storeName: string;
    address: string;
    city: string;
    neighborhood: string;
    phone: string;
    email: string;
    hours: string;
    facebook: string;
    instagram: string;
    socialLinks: Array<{ id: string; name: string; url: string }>;
    aboutText: string;
    branches: Array<{
      id: string;
      name: string;
      address: string;
      city?: string;
      neighborhood?: string;
      phone?: string;
      email?: string;
      hours?: string;
    }>;
  };
  bioLinks: Array<{ label: string; url: string; enabled: boolean }>;
  banners: {
    mainImage: string;
    mainTitle: string;
    mainSubtitle: string;
    secondaryImage: string;
    tertiaryImage: string;
  };
}

export const defaultSiteSettings: SiteSettings = {
  brand: {
    logoUrl: '',
    primaryColor: '#067647',
    secondaryColor: '#334155',
  },
  commerceEnabled: true,
  payments: {
    pix: { enabled: true, key: '' },
    cardOnDelivery: true,
    cash: true,
    foodVoucher: false,
  },
  pwa: {
    enabled: true,
    googlePlay: { enabled: false, url: '' },
    appStore: { enabled: false, url: '' },
  },
  channels: {
    whatsappEnabled: true,
    whatsappNumber: process.env.NEXT_PUBLIC_STORE_WHATSAPP ?? '551140044040',
    ifoodEnabled: true,
    ifoodUrl: process.env.NEXT_PUBLIC_IFOOD_STORE_URL ?? '',
    offersGroupUrl: '',
  },
  features: { cardApplicationsEnabled: true, clubEnabled: true },
  topbar: {
    enabled: true,
    text: 'Entrega grátis na primeira compra acima de R$ 150',
  },
  institution: {
    storeName: 'VerdeVale Supermercados',
    address: 'Rua das Palmeiras, 120 — Centro',
    city: '',
    neighborhood: '',
    phone: '(11) 4004-4040',
    email: 'atendimento@verdevale.com.br',
    hours: 'Segunda a sábado, das 7h às 21h · Domingo, das 8h às 14h',
    facebook: '',
    instagram: '',
    socialLinks: [],
    aboutText:
      'Uma experiência de mercado próxima, prática e feita para acompanhar a rotina de cada família. Reunimos produtos, ofertas e atendimento em um só lugar, com transparência e cuidado em cada etapa.',
    branches: [
      {
        id: 'centro',
        name: 'VerdeVale Centro',
        address: 'Rua das Palmeiras, 120 — Centro',
        phone: '(11) 4004-4040',
        email: 'atendimento@verdevale.com.br',
        hours: 'Segunda a sábado, das 7h às 21h · Domingo, das 8h às 14h',
      },
    ],
  },
  bioLinks: [
    { label: 'Ofertas relâmpago', url: '/catalogo?ofertas=1', enabled: true },
    { label: 'Panfleto de Ofertas', url: '/panfleto-de-ofertas', enabled: true },
    { label: 'Clube SuperVerde', url: '/clube', enabled: true },
    { label: 'Trabalhe conosco', url: '/trabalhe-conosco', enabled: true },
    { label: 'WhatsApp', url: '', enabled: true },
  ],
  banners: {
    mainImage: '',
    mainTitle: 'A semana mais fresca do ano.',
    mainSubtitle: 'Hortifrúti selecionado com preços especiais.',
    secondaryImage: '',
    tertiaryImage: '',
  },
};

export function mergeSiteSettings(value: unknown): SiteSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultSiteSettings;
  }

  const input = value as Partial<SiteSettings>;
  return {
    ...defaultSiteSettings,
    ...input,
    brand: { ...defaultSiteSettings.brand, ...input.brand },
    payments: {
      ...defaultSiteSettings.payments,
      ...input.payments,
      pix: { ...defaultSiteSettings.payments.pix, ...input.payments?.pix },
    },
    pwa: {
      ...defaultSiteSettings.pwa,
      ...input.pwa,
      googlePlay: {
        ...defaultSiteSettings.pwa.googlePlay,
        ...input.pwa?.googlePlay,
      },
      appStore: {
        ...defaultSiteSettings.pwa.appStore,
        ...input.pwa?.appStore,
      },
    },
    channels: { ...defaultSiteSettings.channels, ...input.channels },
    features: { ...defaultSiteSettings.features, ...input.features },
    topbar: { ...defaultSiteSettings.topbar, ...input.topbar },
    institution: {
      ...defaultSiteSettings.institution,
      ...input.institution,
      branches: Array.isArray(input.institution?.branches)
        ? input.institution.branches
        : defaultSiteSettings.institution.branches,
      socialLinks: Array.isArray(input.institution?.socialLinks)
        ? input.institution.socialLinks.filter(
            (link): link is { id: string; name: string; url: string } =>
              typeof link === 'object' &&
              link !== null &&
              typeof link.id === 'string' &&
              typeof link.name === 'string' &&
              typeof link.url === 'string',
          )
        : defaultSiteSettings.institution.socialLinks,
    },
    bioLinks: Array.isArray(input.bioLinks)
      ? input.bioLinks.map((link) =>
          link.url === '/tabloide' || link.label.toLocaleLowerCase('pt-BR').includes('tabloide')
            ? { ...link, label: 'Panfleto de Ofertas', url: '/panfleto-de-ofertas' }
            : link,
        )
      : defaultSiteSettings.bioLinks,
    banners: { ...defaultSiteSettings.banners, ...input.banners },
  };
}

export function isSafeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeSiteLink(value: string) {
  return (value.startsWith('/') && !value.startsWith('//')) || isSafeWebUrl(value);
}

export function currentStoreDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
