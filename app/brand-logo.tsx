'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { useSiteSettings } from './admin-data-provider';

export default function BrandLogo({
  compact = false,
  inverted = false,
  name,
}: {
  compact?: boolean;
  inverted?: boolean;
  name?: string;
}) {
  const { settings } = useSiteSettings();
  const storeName = name?.trim() || settings.institution.storeName.trim() || 'Supermercado';
  const [brand, ...remainingName] = storeName.split(/\s+/);

  return (
    <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label={`${storeName} - início`}>
      {settings.brand.logoUrl ? (
        <Image
          src={settings.brand.logoUrl}
          alt=""
          width={compact ? 36 : 44}
          height={compact ? 36 : 44}
          unoptimized
          className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-11 sm:w-11"
        />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11 ${
            inverted
              ? 'border border-zinc-800 bg-zinc-900 text-zinc-200'
              : 'bg-emerald-800'
          }`}
        >
          <Store size={compact ? 19 : 22} />
        </span>
      )}
      <span className="min-w-0 max-w-[8rem] leading-tight sm:max-w-none">
        <span
          className={`block truncate text-base font-black tracking-tight sm:text-lg ${
            inverted ? 'text-white' : 'text-slate-900'
          }`}
        >
          {brand} {remainingName.join(' ')}
        </span>
        {!compact && (
          <span
            className={`hidden text-[10px] font-semibold uppercase tracking-wider sm:block ${
              inverted ? 'text-zinc-400' : 'text-slate-500'
            }`}
          >
            Mercado de qualidade
          </span>
        )}
      </span>
    </Link>
  );
}
