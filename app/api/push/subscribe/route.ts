import {
  createPushServiceClient,
  isPushSubscription,
  resolveSubscriptionUserId,
} from '@/lib/push-server';

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
    const supabase = createPushServiceClient();
    const { data: previous, error: lookupError } = await supabase
      .from('push_subscriptions')
      .select('usuario_id')
      .eq('endpoint', body.endpoint)
      .maybeSingle();
    if (lookupError) throw new Error(`Não foi possível consultar a inscrição existente: ${lookupError.message}`);

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: body.endpoint,
        subscription: body,
        usuario_id: userId ?? previous?.usuario_id ?? null,
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw new Error(`Não foi possível salvar a inscrição: ${error.message}`);

    return Response.json({ subscribed: true }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Falha ao registrar inscrição push.';
    return Response.json({ error: message }, { status: 500 });
  }
}
