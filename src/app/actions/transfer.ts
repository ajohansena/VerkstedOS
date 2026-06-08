'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  acceptTransfer,
  confirmArrival,
  initiateTransfer,
  type CaseTransfer,
} from '@/modules/case/public';

/**
 * Multi-location transfer actions (User surface, Sprint 13). The service layer
 * enforces case:edit, validates same-workshop + blocking segments, and flips
 * the case's assignment + current_workshop_id on arrival. Norwegian errors.
 */

export async function initiateTransferAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const toWorkshopId = String(formData.get('toWorkshopId') ?? '');
  const transportMode = String(
    formData.get('transportMode') ?? 'drive',
  ) as CaseTransfer['transportMode'];
  const reason = String(formData.get('reason') ?? '').trim();
  if (!toWorkshopId) redirect(`/cases/${caseId}`);

  try {
    await initiateTransfer(session.context, {
      caseId,
      toWorkshopId,
      transportMode,
      ...(reason ? { reason } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Overføring feilet';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/cases/${caseId}`);
}

export async function acceptTransferAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  const transferId = String(formData.get('transferId') ?? '');
  await acceptTransfer(session.context, transferId);
  redirect(`/cases/${caseId}`);
}

export async function confirmArrivalAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  const transferId = String(formData.get('transferId') ?? '');
  await confirmArrival(session.context, transferId);
  redirect(`/cases/${caseId}`);
}
