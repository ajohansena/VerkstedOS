import { NextResponse } from 'next/server';

import {
  handleInboundReply,
  resolveOpenThreadByContact,
  storeInboundMessage,
} from '@/modules/communication/public';

/**
 * POST /api/v1/sms/inbound — inbound SMS webhook (no auth session; secured by a
 * shared secret the gateway sends). When the customer replies to an acceptance
 * SMS, the message is stored (traceable) and, if it reads OK/JA…, the pending
 * acceptance is marked accepted.
 *
 * Body (provider-agnostic, mapped by the gateway config):
 *   { "from": "+4799887766", "body": "OK", "messageId": "..." }
 *
 * Until an SMS provider is wired, this endpoint already works for testing and
 * for whichever gateway is chosen (LinkMobility / Sveve) — only the payload
 * mapping differs.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.SMS_INBOUND_SECRET;
  if (expected) {
    const provided =
      request.headers.get('x-webhook-secret') ??
      new URL(request.url).searchParams.get('secret');
    if (provided !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let payload: { from?: string; body?: string; messageId?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const from = payload.from?.trim();
  const body = payload.body?.trim();
  if (!from || !body) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const thread = await resolveOpenThreadByContact('sms', from);
  if (!thread) {
    // No open conversation for this number — accept the webhook but do nothing.
    return NextResponse.json({ status: 'no_thread' });
  }

  await storeInboundMessage({
    organizationId: thread.organizationId,
    threadId: thread.threadId,
    channel: 'sms',
    body,
    providerMessageId: payload.messageId ?? null,
  });

  const acceptance = await handleInboundReply({
    organizationId: thread.organizationId,
    threadId: thread.threadId,
    body,
  });

  return NextResponse.json({
    status: 'ok',
    accepted: acceptance?.status === 'accepted',
  });
}
