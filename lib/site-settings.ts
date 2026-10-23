export const SITE_SETTINGS_TABLE = 'configuracoes_site';

export interface HeroCampaignCopy {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  button: string;
  image: string;
}

export interface SiteSettings {
  brand: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
  };
  venda_online_ativa: boolean;
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
    tiktok: string;
    socialLinks: Array<{ id: string; name: string; url: string }>;
    aboutTitle: string;
    aboutText: string;
    aboutValues: Array<{ title: string; description: string }>;
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
    campaigns: HeroCampaignCopy[];
    secondaryImage: string;
    tertiaryImage: string;
  };
}

export const LEGACY_SHORT_ABOUT_TEXT =
  'Uma experiência de mercado próxima, prática e feita para acompanhar a rotina de cada família. Reunimos produtos, ofertas e atendimento em um só lugar, com transparência e cuidado em cada etapa.';

export const DEFAULT_ABOUT_TITLE =
  'Frescor, cuidado e praticidade no dia a dia';

export const DEFAULT_ABOUT_TEXT = [
  LEGACY_SHORT_ABOUT_TEXT,
  'Nosso compromisso é comunicar preços e condições de forma transparente, valorizar o atendimento próximo e tornar a compra mais simples — online ou na loja física.',
  'A disponibilidade de produtos, preços, horários e formas de entrega pode variar por filial. Consulte as informações atualizadas e fale com a equipe antes de concluir uma compra.',
].join('\n\n');

export const DEFAULT_ABOUT_VALUES: Array<{ title: string; description: string }> = [
  {
    title: 'Cuidado',
    description: 'Atenção à seleção e à informação de cada produto.',
  },
  {
    title: 'Conveniência',
    description: 'Ofertas, encarte e catálogo acessíveis pelo celular.',
  },
  {
    title: 'Transparência',
    description: 'Condições de compra e atendimento apresentados com clareza.',
  },
];

export const defaultSiteSettings: SiteSettings = {
  brand: {
    logoUrl: '',
    primaryColor: '#067647',
    secondaryColor: '#334155',
  },
  venda_online_ativa: true,
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
    facebook: 'https://www.facebook.com',
    instagram: 'https://www.instagram.com',
    tiktok: 'https://www.tiktok.com',
    socialLinks: [],
    aboutTitle: DEFAULT_ABOUT_TITLE,
    aboutText: DEFAULT_ABOUT_TEXT,
    aboutValues: DEFAULT_ABOUT_VALUES,
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
    { label: 'Clube de Descontos', url: '/clube', enabled: true },
    { label: 'Trabalhe conosco', url: '/trabalhe-conosco', enabled: true },
    { label: 'WhatsApp', url: '', enabled: true },
  ],
  banners: {
    mainImage: '',
    mainTitle: 'A semana mais fresca do ano.',
    mainSubtitle: 'Hortifrúti selecionado com preços especiais.',
    campaigns: [
      {
        id: 'hortifruti',
        eyebrow: 'É tempo de coisa boa',
        title: 'A semana mais fresca do ano.',
        subtitle: 'Hortifrúti selecionado com preços especiais.',
        button: 'Explorar a feirinha',
        image:
          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=90',
      },
      {
        id: 'carnes',
        eyebrow: 'Seu churrasco merece',
        title: 'O melhor do fim de semana começa aqui.',
        subtitle:
          'Cortes especiais, acompanhamentos fresquinhos e tudo para reunir quem você gosta.',
        button: 'Ver ofertas de carnes',
        image:
          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1800&q=90',
      },
      {
        id: 'praticidade',
        eyebrow: 'Praticidade todo dia',
        title: 'Sua despensa cheia. Seu tempo livre também.',
        subtitle:
          'Receba em casa os favoritos da família com entrega rápida e cuidado de verdade.',
        button: 'Fazer minhas compras',
        image:
          'https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1800&q=90',
      },
    ],
    secondaryImage: '',
    tertiaryImage: '',
  },
};

export function resolveOnlineSalesEnabled(
  value: unknown,
  row?: Record<string, unknown> | null,
): boolean {
  if (row && typeof row === 'object') {
    if (typeof row.venda_online_ativa === 'boolean') {
      return row.venda_online_ativa;
    }
    if (typeof row.commerce_enabled === 'boolean') {
      return row.commerce_enabled;
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.venda_online_ativa === 'boolean') {
      return record.venda_online_ativa;
    }
    if (typeof record.commerceEnabled === 'boolean') {
      return record.commerceEnabled;
    }
    if (typeof record.plano === 'string') {
      const normalizedPlan = record.plano.trim().toLowerCase();
      if (normalizedPlan === 'catalogo' || normalizedPlan === 'vitrine') {
        return false;
      }
      if (normalizedPlan === 'ecommerce' || normalizedPlan === 'venda_online') {
        return true;
      }
    }
  }

  if (row && typeof row === 'object' && row.settings && typeof row.settings === 'object') {
    const settingsObj = row.settings as Record<string, unknown>;
    if (typeof settingsObj.venda_online_ativa === 'boolean') {
      return settingsObj.venda_online_ativa;
    }
    if (typeof settingsObj.commerceEnabled === 'boolean') {
      return settingsObj.commerceEnabled;
    }
  }

  return defaultSiteSettings.venda_online_ativa;
}

export function mergeSiteSettings(
  value: unknown,
  row?: Record<string, unknown> | null,
): SiteSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const onlineSales = resolveOnlineSalesEnabled(value, row);
    return {
      ...defaultSiteSettings,
      venda_online_ativa: onlineSales,
      commerceEnabled: onlineSales,
    };
  }

  const input = value as Partial<SiteSettings>;
  const onlineSalesEnabled = resolveOnlineSalesEnabled(value, row);
  const inputCampaigns = input.banners?.campaigns;
  const campaigns = Array.isArray(inputCampaigns) && inputCampaigns.length > 0
    ? inputCampaigns.map((campaign, index) => {
        if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) {
          return defaultSiteSettings.banners.campaigns[index] ??
            defaultSiteSettings.banners.campaigns[0];
        }
        const fallback =
          defaultSiteSettings.banners.campaigns[index] ??
          defaultSiteSettings.banners.campaigns[0];
        return {
          id: typeof campaign.id === 'string' && campaign.id ? campaign.id : `campaign-${index + 1}`,
          eyebrow:
            typeof campaign.eyebrow === 'string' ? campaign.eyebrow : fallback.eyebrow,
          title: typeof campaign.title === 'string' ? campaign.title : fallback.title,
          subtitle:
            typeof campaign.subtitle === 'string'
              ? campaign.subtitle
              : fallback.subtitle,
          button: typeof campaign.button === 'string' ? campaign.button : fallback.button,
          image:
            typeof campaign.image === 'string' && campaign.image
              ? campaign.image
              : index === 0 && typeof input.banners?.mainImage === 'string' && input.banners.mainImage
                ? input.banners.mainImage
                : fallback.image,
        };
      })
    : [
        {
          ...defaultSiteSettings.banners.campaigns[0],
          image:
            typeof input.banners?.mainImage === 'string' && input.banners.mainImage
              ? input.banners.mainImage
              : defaultSiteSettings.banners.campaigns[0].image,
          title:
            typeof input.banners?.mainTitle === 'string' &&
            input.banners.mainTitle.trim()
              ? input.banners.mainTitle
              : defaultSiteSettings.banners.campaigns[0].title,
          subtitle:
            typeof input.banners?.mainSubtitle === 'string' &&
            input.banners.mainSubtitle.trim()
              ? input.banners.mainSubtitle
              : defaultSiteSettings.banners.campaigns[0].subtitle,
        },
        ...defaultSiteSettings.banners.campaigns.slice(1),
      ];

  const resolvedStoreName =
    typeof input.institution?.storeName === 'string' &&
    input.institution.storeName.trim()
      ? input.institution.storeName.trim()
      : defaultSiteSettings.institution.storeName;
  const rawBranches =
    Array.isArray(input.institution?.branches) &&
    input.institution.branches.length > 0
      ? input.institution.branches
      : defaultSiteSettings.institution.branches;
  const branches = rawBranches.map((branch, index) => {
    if (
      index === 0 &&
      branch.name === defaultSiteSettings.institution.branches[0].name &&
      resolvedStoreName !== defaultSiteSettings.institution.storeName
    ) {
      return { ...branch, name: resolvedStoreName };
    }
    return branch;
  });

  return {
    ...defaultSiteSettings,
    ...input,
    venda_online_ativa: onlineSalesEnabled,
    commerceEnabled: onlineSalesEnabled,
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
      storeName: resolvedStoreName,
      aboutTitle:
        typeof input.institution?.aboutTitle === 'string' &&
        input.institution.aboutTitle.trim()
          ? input.institution.aboutTitle.trim()
          : DEFAULT_ABOUT_TITLE,
      aboutText:
        typeof input.institution?.aboutText === 'string' &&
        input.institution.aboutText.trim() &&
        input.institution.aboutText.trim() !== LEGACY_SHORT_ABOUT_TEXT
          ? input.institution.aboutText
          : DEFAULT_ABOUT_TEXT,
      aboutValues:
        Array.isArray(input.institution?.aboutValues) &&
        input.institution.aboutValues.length > 0
          ? input.institution.aboutValues.map((item, idx) => {
              const fallback = DEFAULT_ABOUT_VALUES[idx] ?? DEFAULT_ABOUT_VALUES[0];
              if (!item || typeof item !== 'object') return fallback;
              return {
                title:
                  typeof item.title === 'string' && item.title.trim()
                    ? item.title
                    : fallback.title,
                description:
                  typeof item.description === 'string' && item.description.trim()
                    ? item.description
                    : fallback.description,
              };
            })
          : DEFAULT_ABOUT_VALUES,
      facebook:
        typeof input.institution?.facebook === 'string' &&
        input.institution.facebook.trim()
          ? input.institution.facebook.trim()
          : defaultSiteSettings.institution.facebook,
      instagram:
        typeof input.institution?.instagram === 'string' &&
        input.institution.instagram.trim()
          ? input.institution.instagram.trim()
          : defaultSiteSettings.institution.instagram,
      tiktok:
        typeof input.institution?.tiktok === 'string' &&
        input.institution.tiktok.trim()
          ? input.institution.tiktok.trim()
          : defaultSiteSettings.institution.tiktok,
      branches,
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
      ? input.bioLinks.map((link) => {
          if (
            link.url === '/tabloide' ||
            link.label.toLocaleLowerCase('pt-BR').includes('tabloide')
          ) {
            return { ...link, label: 'Panfleto de Ofertas', url: '/panfleto-de-ofertas' };
          }
          if (link.label.includes('SuperVerde')) {
            return {
              ...link,
              label: link.label.replace(/SuperVerde/g, resolvedStoreName),
            };
          }
          return link;
        })
      : defaultSiteSettings.bioLinks,
    banners: {
      ...defaultSiteSettings.banners,
      ...input.banners,
      campaigns,
    },
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

export function resolveSocialUrl(
  rawValue: string | undefined,
  platform: 'instagram' | 'facebook' | 'tiktok',
  socialLinks?: Array<{ id: string; name: string; url: string }>,
): string {
  const baseMap = {
    instagram: 'https://www.instagram.com',
    facebook: 'https://www.facebook.com',
    tiktok: 'https://www.tiktok.com',
  } as const;

  let candidate = (rawValue ?? '').trim();
  if (!candidate && Array.isArray(socialLinks)) {
    const matched = socialLinks.find((item) =>
      item.name.toLocaleLowerCase('pt-BR').includes(platform),
    );
    if (matched?.url) candidate = matched.url.trim();
  }

  if (!candidate) return baseMap[platform];
  if (isSafeWebUrl(candidate)) return candidate;
  if (candidate.startsWith('@')) {
    const handle = candidate.slice(1).trim();
    return platform === 'tiktok'
      ? `${baseMap.tiktok}/@${handle}`
      : `${baseMap[platform]}/${handle}`;
  }
  if (candidate.includes('.')) {
    const withHttps = `https://${candidate.replace(/^\/+/, '')}`;
    if (isSafeWebUrl(withHttps)) return withHttps;
  }
  return baseMap[platform];
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
