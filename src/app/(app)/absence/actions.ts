'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  approveAbsence,
  cancelAbsence,
  declineAbsence,
  requestAbsence,
} from '@/modules/workforce/public';

function parseDate(value: FormDataEntryValue | null): Date {
  const s = String(value ?? '').trim();
  if (!s) throw new Error('DATE_REQUIRED');
  // datetime-local → treat as local time
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('DATE_INVALID');
  return d;
}

export async function submitAbsenceRequest(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const employeeId = String(formData.get('employeeId') ?? '').trim();
  const absenceTypeId = String(formData.get('absenceTypeId') ?? '').trim();
  const startsAt = parseDate(formData.get('startsAt'));
  const endsAt = parseDate(formData.get('endsAt'));
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!employeeId || !absenceTypeId) return;
  await requestAbsence(session.context, {
    employeeId,
    absenceTypeId,
    startsAt,
    endsAt,
    note,
  });
  revalidatePath('/absence');
  revalidatePath('/admin/absence');
}

export async function approveAbsenceAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  await approveAbsence(session.context, id);
  revalidatePath('/admin/absence');
  revalidatePath('/absence');
  revalidatePath('/production');
}

export async function declineAbsenceAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const id = String(formData.get('id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id || !reason) return;
  await declineAbsence(session.context, id, reason);
  revalidatePath('/admin/absence');
}

export async function cancelAbsenceAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  await cancelAbsence(session.context, id);
  revalidatePath('/absence');
}
