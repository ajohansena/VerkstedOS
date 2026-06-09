'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import {
  approveDangerousOp,
  cancelDangerousOp,
  executeDangerousOp,
  rejectDangerousOp,
  requestDangerousOp,
  TwoPersonRuleViolationError,
} from '@/modules/platform/public';

/**
 * /dev/two-person Server Actions (Sprint 20). Each action is guarded by the
 * `(dev)` layout's `requirePlatformAccess`; mutations are recorded to
 * `platform_audit_events` so the queue itself is auditable.
 */

const VALID_KINDS = new Set([
  'org_lock',
  'org_unlock',
  'jobs_pause',
  'jobs_resume',
  'maintenance_mode_on',
  'maintenance_mode_off',
  'data_delete',
  'data_restore',
]);

export async function requestDangerousOpAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const kindRaw = String(formData.get('kind') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const orgIdRaw = String(formData.get('organizationId') ?? '').trim();
  if (!VALID_KINDS.has(kindRaw)) return;
  if (reason.length < 8) return;

  const row = await requestDangerousOp({
    organizationId: orgIdRaw || null,
    kind: kindRaw as
      | 'org_lock'
      | 'org_unlock'
      | 'jobs_pause'
      | 'jobs_resume'
      | 'maintenance_mode_on'
      | 'maintenance_mode_off'
      | 'data_delete'
      | 'data_restore',
    reason,
    requestedByUserId: ctx.userId,
  });

  await recordPlatformAudit(ctx, {
    action: 'dangerous_op_requested',
    targetOrgId: orgIdRaw || null,
    reason,
    after: { id: row.id, kind: row.kind, status: row.status },
  });

  revalidatePath('/dev/two-person');
}

export async function approveDangerousOpAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  try {
    const row = await approveDangerousOp({
      id,
      approvedByUserId: ctx.userId,
    });
    await recordPlatformAudit(ctx, {
      action: 'dangerous_op_approved',
      targetOrgId: row.organizationId,
      reason: `Approved ${row.kind}`,
      after: { id: row.id, status: row.status },
    });
  } catch (err) {
    if (err instanceof TwoPersonRuleViolationError) {
      // Surface silently — the UI disables the button for the requestor; this
      // is a defense-in-depth check.
      return;
    }
    throw err;
  }
  revalidatePath('/dev/two-person');
}

export async function rejectDangerousOpAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '').trim() || 'Rejected.';
  if (!id) return;
  try {
    const row = await rejectDangerousOp({
      id,
      approvedByUserId: ctx.userId,
      outcome,
    });
    await recordPlatformAudit(ctx, {
      action: 'dangerous_op_rejected',
      targetOrgId: row.organizationId,
      reason: outcome,
      after: { id: row.id, status: row.status },
    });
  } catch (err) {
    if (err instanceof TwoPersonRuleViolationError) return;
    throw err;
  }
  revalidatePath('/dev/two-person');
}

export async function executeDangerousOpAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '').trim() || 'Executed.';
  if (!id) return;
  try {
    const row = await executeDangerousOp({
      id,
      executedByUserId: ctx.userId,
      outcome,
    });
    await recordPlatformAudit(ctx, {
      action: 'dangerous_op_executed',
      targetOrgId: row.organizationId,
      reason: outcome,
      after: { id: row.id, status: row.status },
    });
  } catch (err) {
    if (err instanceof TwoPersonRuleViolationError) return;
    throw err;
  }
  revalidatePath('/dev/two-person');
}

export async function cancelDangerousOpAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '').trim() || 'Cancelled.';
  if (!id) return;
  const row = await cancelDangerousOp({ id, outcome });
  await recordPlatformAudit(ctx, {
    action: 'dangerous_op_cancelled',
    targetOrgId: row.organizationId,
    reason: outcome,
    after: { id: row.id, status: row.status },
  });
  revalidatePath('/dev/two-person');
}
