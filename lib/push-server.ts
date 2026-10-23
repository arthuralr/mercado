import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import webpush, { type PushSubscription } from 'web-push';
import { getPublicVapidKey, getServerVapidConfig } from './vapid-config';

const allowedPushHosts = [
  'fcm.googleapis.com',
  'web.push.apple.com',
  '.push.services.mozilla.com',
  '.push.services.mozilla.org',
  '.notify.windows.com',
];

const FALLBACK_STORE_PATH = path.join(
  os.tmpdir(),
  'supermarket-fresh-push-subscriptions.json',
);

export interface StoredPushSubscriptionRow {
  endpoint: string;
  subscription: PushSubscription;
  usuario_id?: string | null;
  atualizado_em?: string;
}

export function initializeWebPush() {
  const { publicKey, privateKey, subject } = getServerVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    webpush,
    publicKey: getPublicVapidKey(),
    subject,
  };
}

export function createPushServiceClient(request?: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no servidor.',
    );
  }

  const authorization = request?.headers.get('authorization');
  return createClient(url, key, {
    ...( !serviceRoleKey && authorization
      ? { global: { headers: { Authorization: authorization } } }
      : {}),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function readFallbackSubscriptions(): Promise<StoredPushSubscriptionRow[]> {
  try {
    const raw = await fs.readFile(FALLBACK_STORE_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredPushSubscriptionRow =>
        Boolean(item) &&
        typeof item === 'object' &&
        'endpoint' in item &&
        typeof item.endpoint === 'string' &&
        'subscription' in item &&
        isPushSubscription(item.subscription),
    );
  } catch {
    return [];
  }
}

async function writeFallbackSubscriptions(rows: StoredPushSubscriptionRow[]): Promise<void> {
  try {
    await fs.writeFile(FALLBACK_STORE_PATH, JSON.stringify(rows, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem errors in serverless environments when Supabase is primary
  }
}

export async function savePushSubscriptionRecord(
  subscription: PushSubscription,
  userId: string | null,
  request?: Request,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const existingFallback = await readFallbackSubscriptions();
  const nextFallback = [
    {
      endpoint: subscription.endpoint,
      subscription,
      usuario_id: userId,
      atualizado_em: nowIso,
    },
    ...existingFallback.filter((item) => item.endpoint !== subscription.endpoint),
  ];
  await writeFallbackSubscriptions(nextFallback);

  try {
    const supabase = createPushServiceClient(request);
    const { data: previous } = await supabase
      .from('push_subscriptions')
      .select('usuario_id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle();

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        subscription,
        usuario_id: userId ?? previous?.usuario_id ?? null,
        atualizado_em: nowIso,
      },
      { onConflict: 'endpoint' },
    );
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error(`Não foi possível salvar a inscrição: ${error.message}`);
    }
  } catch (caught) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw caught;
    }
  }
}

export async function listPushSubscriptionRecords(
  request?: Request,
): Promise<StoredPushSubscriptionRow[]> {
  const byEndpoint = new Map<string, StoredPushSubscriptionRow>();

  const fallbackRows = await readFallbackSubscriptions();
  for (const row of fallbackRows) {
    if (isPushSubscription(row.subscription)) {
      byEndpoint.set(row.endpoint, row);
    }
  }

  try {
    const supabase = createPushServiceClient(request);
    const { data: rows, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, subscription');
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error(`Não foi possível carregar inscrições: ${error.message}`);
    }
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (isPushSubscription(row.subscription)) {
          byEndpoint.set(row.endpoint, {
            endpoint: row.endpoint,
            subscription: row.subscription,
          });
        }
      }
    }
  } catch (caught) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && byEndpoint.size === 0) {
      throw caught;
    }
  }

  return Array.from(byEndpoint.values());
}

export async function removeStalePushSubscriptions(
  endpoints: string[],
  request?: Request,
): Promise<string | undefined> {
  const uniqueEndpoints = [...new Set(endpoints)];
  if (!uniqueEndpoints.length) return undefined;

  const existingFallback = await readFallbackSubscriptions();
  const filteredFallback = existingFallback.filter(
    (item) => !uniqueEndpoints.includes(item.endpoint),
  );
  await writeFallbackSubscriptions(filteredFallback);

  try {
    const supabase = createPushServiceClient(request);
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', uniqueEndpoints);
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return 'Não foi possível remover todas as inscrições expiradas.';
    }
  } catch {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return 'Não foi possível remover todas as inscrições expiradas.';
    }
  }
  return undefined;
}

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      allowedPushHosts.some((host) =>
        host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host,
      )
    );
  } catch {
    return false;
  }
}

export function isPushSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== 'object' || !('endpoint' in value) || !('keys' in value)) {
    return false;
  }
  const candidate = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown } | null;
  };
  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.length <= 2048 &&
    isAllowedPushEndpoint(candidate.endpoint) &&
    !!candidate.keys &&
    typeof candidate.keys.p256dh === 'string' &&
    /^[A-Za-z0-9_-]{16,256}$/.test(candidate.keys.p256dh) &&
    typeof candidate.keys.auth === 'string' &&
    /^[A-Za-z0-9_-]{16,256}$/.test(candidate.keys.auth)
  );
}

async function resolveBearerUser(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { userId: null, error: null };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { userId: null, error: 'A configuração pública do Supabase está incompleta.' };
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { userId: null, error: 'Sessão inválida ou expirada.' };
  return { userId: data.user.id, error: null };
}

export async function requirePushManager(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.match(/^Bearer\s+.+$/i)) {
    return { response: Response.json({ error: 'Autenticação necessária.' }, { status: 401 }) };
  }
  const { userId, error } = await resolveBearerUser(request);
  if (error || !userId) {
    return { response: Response.json({ error: error ?? 'Sessão inválida.' }, { status: 401 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response: Response.json({ error: 'Configuração do Supabase incompleta.' }, { status: 500 }) };
  }
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: manager, error: managerError } = await client
    .from('gestores')
    .select('usuario_id')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (managerError) {
    return {
      response: Response.json(
        { error: `Não foi possível validar o acesso do gestor: ${managerError.message}` },
        { status: 500 },
      ),
    };
  }
  if (!manager) {
    return { response: Response.json({ error: 'Acesso restrito a gestores autorizados.' }, { status: 403 }) };
  }
  return { userId };
}

export async function resolveSubscriptionUserId(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) return { userId: null, error: null };
  if (!authorization.match(/^Bearer\s+.+$/i)) {
    return { userId: null, error: 'Cabeçalho de autenticação inválido.' };
  }
  return resolveBearerUser(request);
}
