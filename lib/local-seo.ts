import { cache } from 'react';
import type { Metadata } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import {
  defaultSiteSettings,
  mergeSiteSettings,
  SITE_SETTINGS_TABLE,
} from '@/lib/site-settings';
import { supabase } from '@/lib/supabase';

export async function getCachedSiteSettings() {
  'use cache';
  cacheTag('site-settings');
  cacheLife({ stale: 30, revalidate: 1, expire: 300 });

  const { data, error } = await supabase
    .from(SITE_SETTINGS_TABLE)
    .select('dados')
    .eq('id', 'principal')
    .maybeSingle();

  if (error) {
    console.error('Não foi possível carregar as configurações para SEO local.', error);
  }

  return mergeSiteSettings(data?.dados ?? defaultSiteSettings);
}

export const getLocalSeoContext = cache(async () => {
  const settings = await getCachedSiteSettings();
  const primaryBranch = settings.institution.branches[0];
  const city = primaryBranch?.city?.trim() || settings.institution.city.trim();
  const neighborhood =
    primaryBranch?.neighborhood?.trim() || settings.institution.neighborhood.trim();
  const location = [neighborhood, city].filter(Boolean).join(', ');
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let siteUrl: URL | null = null;

  if (configuredSiteUrl) {
    try {
      const parsedUrl = new URL(configuredSiteUrl);
      if (parsedUrl.protocol === 'https:' || parsedUrl.hostname === 'localhost') {
        siteUrl = parsedUrl;
      } else {
        console.error('NEXT_PUBLIC_SITE_URL precisa usar HTTPS em produção.');
      }
    } catch (urlError) {
      console.error('NEXT_PUBLIC_SITE_URL não contém uma URL válida.', urlError);
    }
  }

  return {
    settings,
    storeName: settings.institution.storeName,
    address: primaryBranch?.address || settings.institution.address,
    city,
    neighborhood,
    location,
    phone: primaryBranch?.phone || settings.institution.phone,
    email: primaryBranch?.email || settings.institution.email,
    siteUrl,
    imageUrl: settings.banners.mainImage || settings.brand.logoUrl || undefined,
    branches: settings.institution.branches,
  };
});

export async function getLocalPageMetadata({
  title,
  description,
  path,
  keywords = [],
  image,
  noIndex = false,
  storeName,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
  storeName?: string;
}): Promise<Metadata> {
  const local = await getLocalSeoContext();
  const name = storeName?.trim() || local.storeName;
  const locationSuffix = local.location ? ` em ${local.location}` : '';
  const absoluteTitle = `${title} | ${name}${locationSuffix}`;
  const absoluteDescription = `${description} ${name}${locationSuffix}.`
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  const canonical = path && local.siteUrl ? new URL(path, local.siteUrl) : undefined;
  const resolvedImage = image || local.imageUrl;
  const regionalKeywords = [
    'supermercado',
    'hortifrúti',
    'hortifruti fresco',
    'açougue',
    'carnes',
    'entrega de supermercado',
    'delivery de mercado',
    name,
    ...(local.city ? [local.city] : []),
    ...(local.neighborhood ? [local.neighborhood] : []),
    ...keywords,
  ];

  return {
    ...(local.siteUrl ? { metadataBase: local.siteUrl } : {}),
    title: { absolute: absoluteTitle },
    description: absoluteDescription,
    keywords: [...new Set(regionalKeywords)],
    alternates: canonical ? { canonical } : undefined,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: name,
      title: absoluteTitle,
      description: absoluteDescription,
      ...(canonical ? { url: canonical } : {}),
      ...(resolvedImage ? { images: [resolvedImage] } : {}),
    },
    twitter: {
      card: resolvedImage ? 'summary_large_image' : 'summary',
      title: absoluteTitle,
      description: absoluteDescription,
      ...(resolvedImage ? { images: [resolvedImage] } : {}),
    },
  };
}

export async function getLocalBusinessStructuredData() {
  const local = await getLocalSeoContext();
  const branches = local.branches.length
    ? local.branches
    : [
        {
          id: 'principal',
          name: local.storeName,
          address: local.address,
          city: local.city,
          neighborhood: local.neighborhood,
          phone: local.phone,
          email: local.email,
        },
      ];

  return {
    '@context': 'https://schema.org',
    '@graph': branches.map((branch) => {
      const city = branch.city?.trim() || local.city;
      const neighborhood = branch.neighborhood?.trim() || local.neighborhood;
      const locality = [neighborhood, city].filter(Boolean).join(', ');
      return {
        '@type': 'GroceryStore',
        name: branch.name || local.storeName,
        ...(local.siteUrl ? { url: local.siteUrl.href } : {}),
        telephone: branch.phone || local.phone,
        email: branch.email || local.email,
        address: {
          '@type': 'PostalAddress',
          streetAddress: branch.address || local.address,
          ...(city ? { addressLocality: city } : {}),
          addressCountry: 'BR',
        },
        ...(locality ? { areaServed: locality } : {}),
      };
    }),
  };
}
