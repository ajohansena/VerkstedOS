'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  approveInvoiceBasis,
  cancelInvoiceBasis,
  exportApprovedBases,
  generateInvoiceBasisForCase,
  retryExport,
} from '@/modules/finance/public';

type ActionResult = { ok: true } | { ok: false; error: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'UNKNOWN_ERROR';
}

/** Generate invoice bases for a case from the locked estimate (Track 15). */
export async function generateInvoiceBasisAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const caseId = String(formData.get('caseId') ?? '');
    if (!caseId) return { ok: false, error: 'MISSING_CASE' };
    await generateInvoiceBasisForCase(session.context, caseId);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/finance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function approveInvoiceBasisAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const basisId = String(formData.get('basisId') ?? '');
    const caseId = String(formData.get('caseId') ?? '');
    if (!basisId) return { ok: false, error: 'MISSING_BASIS' };
    await approveInvoiceBasis(session.context, basisId);
    if (caseId) revalidatePath(`/cases/${caseId}`);
    revalidatePath('/finance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function cancelInvoiceBasisAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const basisId = String(formData.get('basisId') ?? '');
    const caseId = String(formData.get('caseId') ?? '');
    const reason = String(formData.get('reason') ?? 'manual');
    if (!basisId) return { ok: false, error: 'MISSING_BASIS' };
    await cancelInvoiceBasis(session.context, basisId, reason);
    if (caseId) revalidatePath(`/cases/${caseId}`);
    revalidatePath('/finance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Bundle approved bases into an immutable accounting export (Track 15). */
export async function exportApprovedBasesAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const raw = String(formData.get('basisIds') ?? '').trim();
    const basisIds = raw ? raw.split(',').filter(Boolean) : undefined;
    await exportApprovedBases(session.context, basisIds);
    revalidatePath('/finance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function retryExportAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const exportId = String(formData.get('exportId') ?? '');
    if (!exportId) return { ok: false, error: 'MISSING_EXPORT' };
    await retryExport(session.context, exportId);
    revalidatePath('/finance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
