'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  importDbsEstimate,
  lockEstimate,
  receiveDbsPayload,
} from '@/modules/estimating/public';

/**
 * Server actions for estimate import & lock (User surface). The service layer
 * enforces estimate:edit / estimate:lock and validates the payload.
 */

export async function importEstimateAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const rawJson = String(formData.get('payload') ?? '');

  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    redirect(
      `/cases/${caseId}/estimate?error=${encodeURIComponent('Invalid JSON')}`,
    );
  }

  // Land the raw payload in the inbox first (audit/replay), then process.
  const { inboxId } = await receiveDbsPayload({
    organizationId: session.context.organizationId,
    payload,
  });

  try {
    await importDbsEstimate(session.context, { caseId, payload, inboxId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    redirect(`/cases/${caseId}/estimate?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}/estimate`);
}

export async function lockEstimateAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const importId = String(formData.get('importId') ?? '');
  await lockEstimate(session.context, importId);
  redirect(`/cases/${caseId}/estimate`);
}
