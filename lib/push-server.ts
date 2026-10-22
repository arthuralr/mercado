import { createClient } from '@supabase/supabase-js';
import type { PushSubscription } from 'web-push';

const allowedPushHosts = [
  'fcm.googleapis.com',
  'web.push.apple.com',
  '.push.services.mozilla.com',
  '.push.services.mozilla.org',
  '.notify.windows.com',
];

export function createPushServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
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
