/**
 * Email gateway adapter (docs/09 Sprint 12 — Resend). Server-only.
 *
 * Email is the BACKUP channel for customers without a phone number (and always
 * an option). Until `RESEND_API_KEY` is set, `sendEmail` returns
 * `{ status: 'not_configured' }` and the caller stores the message as `queued`.
 * The provider call is isolated here so wiring it later is a one-file change.
 */

export type EmailSendResult =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_SENDER);
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { status: 'not_configured' };
  }
  // Resend integration goes here when wired.
  void to;
  void subject;
  void body;
  return { status: 'failed', error: 'Email provider not implemented yet' };
}
