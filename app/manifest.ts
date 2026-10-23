import type { MetadataRoute } from 'next';
import { getLocalSeoContext } from '@/lib/local-seo';
import { isSafeSiteLink } from '@/lib/site-settings';

function resolveIconMimeType(url: string): string {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { storeName, settings } = await getLocalSeoContext();
  const shortName = storeName.split(/\s+/)[0] || storeName;
  const rawLogoUrl = settings.brand.logoUrl?.trim() ?? '';
  const hasCustomLogo = Boolean(rawLogoUrl && isSafeSiteLink(rawLogoUrl));
  const iconSrc192 = hasCustomLogo ? rawLogoUrl : '/icons/icon-192.png';
  const iconSrc512 = hasCustomLogo ? rawLogoUrl : '/icons/icon-512.png';
  const iconType192 = resolveIconMimeType(iconSrc192);
  const iconType512 = resolveIconMimeType(iconSrc512);
  const themeColor =
    /^#[0-9a-fA-F]{6}$/.test(settings.brand.primaryColor ?? '')
      ? settings.brand.primaryColor
      : '#067647';

  return {
    name: storeName,
    short_name: shortName,
    description: `Ofertas, produtos frescos e compras do ${storeName}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8f4',
    theme_color: themeColor,
    icons: [
      {
        src: iconSrc192,
        sizes: '192x192',
        type: iconType192,
        purpose: 'any',
      },
      {
        src: iconSrc192,
        sizes: '192x192',
        type: iconType192,
        purpose: 'maskable',
      },
      {
        src: iconSrc512,
        sizes: '512x512',
        type: iconType512,
        purpose: 'any',
      },
      {
        src: iconSrc512,
        sizes: '512x512',
        type: iconType512,
        purpose: 'maskable',
      },
    ],
  };
}
