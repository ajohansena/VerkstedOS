'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  ensureProductionOrder,
  transitionState,
} from '@/modules/production/public';

/**
 * Server actions for production state transitions (User surface). The service
 * enforces production:transition, validates the move against the workflow, and
 * updates the projection + append-only history.
 */

export async function ensureOrderAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  await ensureProductionOrder(session.context, caseId);
  redirect(`/cases/${caseId}`);
}

export async function transitionAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const toStateCode = String(formData.get('toStateCode') ?? '');
  const reasonRaw = String(formData.get('reason') ?? '');

  try {
    await transitionState(session.context, {
      caseId,
      toStateCode,
      ...(reasonRaw ? { reason: reasonRaw } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transition failed';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}`);
}
