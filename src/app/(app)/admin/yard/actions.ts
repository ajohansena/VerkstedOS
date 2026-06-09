'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  createYardLayout,
  createYardLocation,
} from '@/modules/yard/public';

type LocationKind = 'parking' | 'bay' | 'storage' | 'temporary';
const KINDS: ReadonlySet<LocationKind> = new Set([
  'parking',
  'bay',
  'storage',
  'temporary',
]);

function parseKind(value: FormDataEntryValue | null): LocationKind {
  const s = String(value ?? '').trim();
  return (KINDS as Set<string>).has(s) ? (s as LocationKind) : 'parking';
}

function parseInt0(value: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function createLayoutAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const workshopId = String(formData.get('workshopId') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!workshopId || !code || !name) return;
  await createYardLayout(session.context, { workshopId, code, name });
  revalidatePath('/admin/yard');
  revalidatePath('/yard/map');
}

export async function createLocationAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const layoutId = String(formData.get('layoutId') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!layoutId || !code) return;
  const qrTag = String(formData.get('qrTag') ?? '').trim() || null;
  await createYardLocation(session.context, {
    layoutId,
    code,
    kind: parseKind(formData.get('kind')),
    capacity: Math.max(1, parseInt0(formData.get('capacity'), 1)),
    rowIndex: parseInt0(formData.get('rowIndex'), 0),
    columnIndex: parseInt0(formData.get('columnIndex'), 0),
    qrTag,
  });
  revalidatePath('/admin/yard');
  revalidatePath('/yard/map');
}
