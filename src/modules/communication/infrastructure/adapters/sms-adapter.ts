/**
 * SMS gateway adapter (docs/09 Sprint 12 — LinkMobility / Sveve). Server-only.
 *
 * NO PROVIDER IS WIRED YET. Until an SMS API key is set, `sendSms` returns
 * `{ status: 'not_configured' }` and the caller stores the message as `queued`
 * — nothing is lost, and queued messages can be flushed when the API arrives.
 * The provider call is isolated here so wiring it later is a one-file change.
 *
 * Inbound replies arrive via the webhook route handler, not here.
 */

export type SmsSendResult =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER);
}

export async function sendSms(
  to: string,
  body: string,
): Promise<SmsSendResult> {
  if (!isSmsConfigured()) {
    return { status: 'not_configured' };
  }
  // Provider integration goes here when the API is provided. Kept intentionally
  // minimal — a single fetch to the gateway, mapping its response to the union.
  void to;
  void body;
  return { status: 'failed', error: 'SMS provider not implemented yet' };
}
