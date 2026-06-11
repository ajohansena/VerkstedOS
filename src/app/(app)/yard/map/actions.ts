'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  moveVehicleByQrTag,
  moveVehicleToLocation,
} from '@/modules/yard/public';

type MoveReason =
  | 'arrival'
  | 'reposition'
  | 'into_bay'
  | 'out_of_bay'
  | 'into_storage'
  | 'departure'
  | 'correction';

const REASONS: ReadonlySet<MoveReason> = new Set([
  'arrival',
  'reposition',
  'into_bay',
  'out_of_bay',
  'into_storage',
  'departure',
  'correction',
]);

function parseReason(value: FormDataEntryValue | null): MoveReason | undefined {
  const s = String(value ?? '').trim();
  return (REASONS as Set<string>).has(s) ? (s as MoveReason) : undefined;
}

export async function moveVehicleAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const caseId = String(formData.get('caseId') ?? '').trim();
  const toLocationId = String(formData.get('toLocationId') ?? '').trim();
  if (!caseId || !toLocationId) return;
  const reason = parseReason(formData.get('reason'));
  const note = String(formData.get('note') ?? '').trim() || null;
  await moveVehicleToLocation(session.context, {
    caseId,
    toLocationId,
    ...(reason ? { reason } : {}),
    note,
  });
  revalidatePath('/yard/map');
}

export async function moveByQrAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const caseId = String(formData.get('caseId') ?? '').trim();
  const qrTag = String(formData.get('qrTag') ?? '').trim();
  if (!caseId || !qrTag) return;
  await moveVehicleByQrTag(session.context, caseId, qrTag);
  revalidatePath('/yard/map');
}
