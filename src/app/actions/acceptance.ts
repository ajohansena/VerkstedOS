'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  recordManualAcceptance,
  requestAcceptance,
} from '@/modules/communication/public';

/**
 * Acceptance actions (User surface). Staff request the customer's approval via
 * SMS (preferred) or email (backup), or record a verbal acceptance. The service
 * stores the conversation + acceptance record (traceable) and enforces
 * case:edit.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function requestAcceptanceAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const channel = String(formData.get('channel') ?? 'sms') as 'sms' | 'email';
  const contactValue = String(formData.get('contactValue') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  if (!contactValue) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent('Mangler kontakt')}`);
  }

  try {
    await requestAcceptance(session.context, {
      caseId,
      channel,
      contactValue,
      ...(summary ? { summary } : {}),
      siteUrl: siteUrl(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Kunne ikke sende godkjenning';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}`);
}

export async function recordManualAcceptanceAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const note = String(formData.get('note') ?? '').trim() || 'Muntlig godkjent';

  await recordManualAcceptance(session.context, caseId, note);
  redirect(`/cases/${caseId}`);
}
