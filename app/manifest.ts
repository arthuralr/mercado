import type { MetadataRoute } from 'next';
import { getLocalSeoContext } from '@/lib/local-seo';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { storeName } = await getLocalSeoContext();
  const shortName = storeName.split(/\s+/)[0] || storeName;

  return {
    name: storeName,
    short_name: shortName,
    description: `Ofertas, produtos frescos e compras do ${storeName}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8f4',
    theme_color: '#067647',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
