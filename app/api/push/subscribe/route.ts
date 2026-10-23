import {
  isPushSubscription,
  resolveSubscriptionUserId,
  savePushSubscriptionRecord,
} from '@/lib/push-server';
import { getPublicVapidKey } from '@/lib/vapid-config';

export async function GET() {
  return Response.json({
    publicKey: getPublicVapidKey(),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Origem da solicitação não autorizada.' }, { status: 403 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) {
    return Response.json({ error: 'Dados da inscrição excedem o limite permitido.' }, { status: 413 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isPushSubscription(body)) {
    return Response.json({ error: 'Inscrição de notificações inválida.' }, { status: 400 });
  }

  const { userId, error: authError } = await resolveSubscriptionUserId(request);
  if (authError) return Response.json({ error: authError }, { status: 401 });

  try {
    await savePushSubscriptionRecord(body, userId, request);
    return Response.json(
      { subscribed: true, publicKey: getPublicVapidKey() },
      { status: 201 },
    );
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : 'Falha ao registrar inscrição push.';
    return Response.json({ error: message }, { status: 500 });
  }
}
