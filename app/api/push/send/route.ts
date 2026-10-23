import {
  initializeWebPush,
  isPushSubscription,
  listPushSubscriptionRecords,
  removeStalePushSubscriptions,
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
  const input = body as {
    title?: unknown;
    message?: unknown;
    link?: unknown;
    icon?: unknown;
  };
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
    return Response.json(
      { error: 'Revise os campos: título (até 80), mensagem (até 240) e link.' },
      { status: 400 },
    );
  }

  const link = input.link.trim();
  if (
    !link.startsWith('/') ||
    link.startsWith('//') ||
    link.includes('\\') ||
    /[\u0000-\u001f]/.test(link)
  ) {
    return Response.json(
      { error: 'O link deve ser um caminho interno, como /panfleto-de-ofertas.' },
      { status: 400 },
    );
  }
  const destination = new URL(link, new URL(request.url).origin);
  if (destination.origin !== new URL(request.url).origin) {
    return Response.json(
      { error: 'O link de destino precisa pertencer a este site.' },
      { status: 400 },
    );
  }

  const iconUrl =
    typeof input.icon === 'string' &&
    input.icon.trim() &&
    input.icon.trim().length <= 1024
      ? input.icon.trim()
      : '/icon.png';

  try {
    const { webpush } = initializeWebPush();
    const rows = await listPushSubscriptionRecords(request);

    const staleEndpoints: string[] = [];
    let sent = 0;
    let failed = 0;
    const payload = JSON.stringify({
      title: input.title.trim(),
      message: input.message.trim(),
      link: destination.pathname + destination.search + destination.hash,
      icon: iconUrl,
    });

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      await Promise.all(
        batch.map(async (row) => {
          if (
            !isPushSubscription(row.subscription) ||
            row.subscription.endpoint !== row.endpoint
          ) {
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
            const status = statusCodeOf(caught);
            if (status === 401 || status === 403 || status === 404 || status === 410) {
              staleEndpoints.push(row.endpoint);
            }
          }
        }),
      );
    }

    const cleanupWarning = await removeStalePushSubscriptions(staleEndpoints, request);

    return Response.json({
      total: rows.length,
      sent,
      failed,
      ...(cleanupWarning ? { warning: cleanupWarning } : {}),
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : 'Falha ao enviar notificações push.';
    return Response.json({ error: message }, { status: 500 });
  }
}
