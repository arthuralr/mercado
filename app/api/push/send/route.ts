import webpush from 'web-push';
import {
  createPushServiceClient,
  isPushSubscription,
  requirePushManager,
} from '@/lib/push-server';

export const maxDuration = 60;

const batchSize = 20;

function statusCodeOf(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const { statusCode } = error;
    if (typeof statusCode === 'number') return statusCode;
  }
  return null;
}

export async function POST(request: Request) {
  const manager = await requirePushManager(request);
  if ('response' in manager) return manager.response;

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 8192) {
    return Response.json({ error: 'A mensagem excede o limite permitido.' }, { status: 413 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Informe título, mensagem e link de destino.' }, { status: 400 });
  }
  const input = body as { title?: unknown; message?: unknown; link?: unknown };
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.trim().length > 80 ||
    typeof input.message !== 'string' ||
    !input.message.trim() ||
    input.message.trim().length > 240 ||
    typeof input.link !== 'string' ||
    input.link.length > 500
  ) {
    return Response.json({ error: 'Revise os campos: título (até 80), mensagem (até 240) e link.' }, { status: 400 });
  }

  const link = input.link.trim();
  if (!link.startsWith('/') || link.startsWith('//') || link.includes('\\') || /[\u0000-\u001f]/.test(link)) {
    return Response.json({ error: 'O link deve ser um caminho interno, como /panfleto-de-ofertas.' }, { status: 400 });
  }
  const destination = new URL(link, new URL(request.url).origin);
  if (destination.origin !== new URL(request.url).origin) {
    return Response.json({ error: 'O link de destino precisa pertencer a este site.' }, { status: 400 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return Response.json(
      { error: 'Configure NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT no servidor.' },
      { status: 503 },
    );
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const supabase = createPushServiceClient();
    const { data: rows, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, subscription');
    if (queryError) throw new Error(`Não foi possível carregar inscrições: ${queryError.message}`);

    const staleEndpoints: string[] = [];
    let sent = 0;
    let failed = 0;
    const payload = JSON.stringify({
      title: input.title.trim(),
      message: input.message.trim(),
      link: destination.pathname + destination.search + destination.hash,
    });

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      await Promise.all(
        batch.map(async (row: { endpoint: string; subscription: unknown }) => {
          if (!isPushSubscription(row.subscription) || row.subscription.endpoint !== row.endpoint) {
            staleEndpoints.push(row.endpoint);
            failed += 1;
            return;
          }
          try {
            await webpush.sendNotification(row.subscription, payload, {
              TTL: 86400,
              urgency: 'normal',
            });
            sent += 1;
          } catch (caught) {
            failed += 1;
            if (statusCodeOf(caught) === 404 || statusCodeOf(caught) === 410) {
              staleEndpoints.push(row.endpoint);
            }
          }
        }),
      );
    }

    let cleanupWarning: string | undefined;
    if (staleEndpoints.length > 0) {
      const { error: cleanupError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', [...new Set(staleEndpoints)]);
      if (cleanupError) cleanupWarning = 'Não foi possível remover todas as inscrições expiradas.';
    }

    return Response.json({
      total: rows.length,
      sent,
      failed,
      ...(cleanupWarning ? { warning: cleanupWarning } : {}),
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Falha ao enviar notificações push.';
    return Response.json({ error: message }, { status: 500 });
  }
}
