'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  ensureProductionOrder,
  transitionState,
  addWorkSegment,
  completeSegment,
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

export async function addSegmentAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const segmentCode = String(formData.get('segmentCode') ?? '');
  const plannedRaw = String(formData.get('plannedMinutes') ?? '');
  const plannedMinutes = Number.parseInt(plannedRaw, 10);

  try {
    await addWorkSegment(session.context, {
      caseId,
      segmentCode,
      ...(Number.isFinite(plannedMinutes) ? { plannedMinutes } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Add segment failed';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}`);
}

export async function completeSegmentAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const segmentId = String(formData.get('segmentId') ?? '');

  try {
    await completeSegment(session.context, segmentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Complete failed';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

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
