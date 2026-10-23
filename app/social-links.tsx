'use client';

import { useSiteSettings } from './admin-data-provider';
import {
  isSafeWebUrl,
  resolveSocialUrl,
  type SiteSettings,
} from '@/lib/site-settings';

export function InstagramOfficialIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2.25"
        y="2.25"
        width="19.5"
        height="19.5"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="2.1"
      />
      <circle
        cx="12"
        cy="12"
        r="4.4"
        stroke="currentColor"
        strokeWidth="2.1"
      />
      <circle cx="17.5" cy="6.5" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function FacebookOfficialIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M13.6 21v-8.2h2.76l.41-3.2H13.6V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.3-.04-1.3-.14-2.47-.14-2.45 0-4.12 1.49-4.12 4.23v2.37H7.54v3.2h2.76V21h3.3Z" />
    </svg>
  );
}

export function TikTokOfficialIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
        fill="#25F4EE"
        transform="translate(-0.7 -0.5)"
      />
      <path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
        fill="#FE2C55"
        transform="translate(0.7 0.5)"
      />
      <path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function hasConfiguredSocialLinks(settings: SiteSettings): boolean {
  const instagramUrl = resolveSocialUrl(
    settings.institution.instagram,
    'instagram',
    settings.institution.socialLinks,
  );
  const facebookUrl = resolveSocialUrl(
    settings.institution.facebook,
    'facebook',
    settings.institution.socialLinks,
  );
  const tiktokUrl = resolveSocialUrl(
    settings.institution.tiktok,
    'tiktok',
    settings.institution.socialLinks,
  );
  const hasExtra = settings.institution.socialLinks.some((item) =>
    isSafeWebUrl(item.url),
  );
  return Boolean(instagramUrl || facebookUrl || tiktokUrl || hasExtra);
}

export function OfficialSocialLinks({
  variant = 'pills',
  className = '',
}: {
  variant?: 'pills' | 'header' | 'bio';
  className?: string;
}) {
  const { settings } = useSiteSettings();
  const storeName = settings.institution.storeName.trim() || 'Supermercado';

  const instagramUrl = resolveSocialUrl(
    settings.institution.instagram,
    'instagram',
    settings.institution.socialLinks,
  );
  const facebookUrl = resolveSocialUrl(
    settings.institution.facebook,
    'facebook',
    settings.institution.socialLinks,
  );
  const tiktokUrl = resolveSocialUrl(
    settings.institution.tiktok,
    'tiktok',
    settings.institution.socialLinks,
  );

  const extraLinks = settings.institution.socialLinks.filter((item) => {
    if (!isSafeWebUrl(item.url)) return false;
    const lower = item.name.toLocaleLowerCase('pt-BR');
    return (
      !lower.includes('instagram') &&
      !lower.includes('facebook') &&
      !lower.includes('tiktok')
    );
  });

  if (
    !instagramUrl &&
    !facebookUrl &&
    !tiktokUrl &&
    extraLinks.length === 0
  ) {
    return null;
  }

  if (variant === 'header') {
    if (!instagramUrl && !facebookUrl && !tiktokUrl) return null;
    return (
      <div
        aria-label={`Redes sociais de ${storeName}`}
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            title={`Instagram oficial de ${storeName}`}
            aria-label={`Instagram oficial de ${storeName}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs transition hover:scale-105 hover:brightness-110"
          >
            <InstagramOfficialIcon size={17} />
          </a>
        )}
        {facebookUrl && (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            title={`Facebook oficial de ${storeName}`}
            aria-label={`Facebook oficial de ${storeName}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-xs transition hover:scale-105 hover:brightness-110"
          >
            <FacebookOfficialIcon size={17} />
          </a>
        )}
        {tiktokUrl && (
          <a
            href={tiktokUrl}
            target="_blank"
            rel="noreferrer"
            title={`TikTok oficial de ${storeName}`}
            aria-label={`TikTok oficial de ${storeName}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#25F4EE]/50 bg-zinc-950 text-white shadow-xs transition hover:scale-105 hover:border-[#FE2C55]"
          >
            <TikTokOfficialIcon size={16} />
          </a>
        )}
      </div>
    );
  }

  if (variant === 'bio') {
    return (
      <div className={`flex flex-wrap justify-center gap-2.5 ${className}`}>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-28 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <InstagramOfficialIcon size={19} />
            <span>Instagram</span>
          </a>
        )}
        {facebookUrl && (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-28 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1877F2] px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <FacebookOfficialIcon size={19} />
            <span>Facebook</span>
          </a>
        )}
        {tiktokUrl && (
          <a
            href={tiktokUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-28 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#25F4EE]/50 bg-zinc-950 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:border-[#FE2C55]"
          >
            <TikTokOfficialIcon size={18} />
            <span>TikTok</span>
          </a>
        )}
        {extraLinks.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
          >
            {link.name}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div
      aria-label={`Redes sociais oficiais de ${storeName}`}
      className={`flex flex-wrap items-center gap-2.5 ${className}`}
    >
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Seguir ${storeName} no Instagram`}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:scale-105 hover:brightness-110"
        >
          <InstagramOfficialIcon size={16} />
          <span>Instagram</span>
        </a>
      )}
      {facebookUrl && (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Seguir ${storeName} no Facebook`}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:scale-105 hover:brightness-110"
        >
          <FacebookOfficialIcon size={16} />
          <span>Facebook</span>
        </a>
      )}
      {tiktokUrl && (
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Seguir ${storeName} no TikTok`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#25F4EE]/60 bg-zinc-900 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:scale-105 hover:border-[#FE2C55]"
        >
          <TikTokOfficialIcon size={16} />
          <span>TikTok</span>
        </a>
      )}
      {extraLinks.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
        >
          {link.name}
        </a>
      ))}
    </div>
  );
}
