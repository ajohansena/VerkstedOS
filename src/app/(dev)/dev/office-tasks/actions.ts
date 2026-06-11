'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import { repairCancelOfficeTask } from '@/modules/platform/public';

/**
 * Dev repair: force-cancel a stuck office task (platform-only, audited).
 *
 * Used when a Phase F template generates a wave of bad tasks across orgs and
 * we need to retire them without going through normal "cancel with reason"
 * paperwork in every org.
 */
export async function repairCancelOfficeTaskAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const organizationId = String(formData.get('organizationId') ?? '').trim();
  const taskId = String(formData.get('taskId') ?? '').trim();
  const reason = String(
    formData.get('reason') ?? 'Force-cancelled via /dev/office-tasks',
  ).trim();
  if (!organizationId || !taskId) return;

  await repairCancelOfficeTask(organizationId, taskId, reason);

  await recordPlatformAudit(ctx, {
    action: 'data_repaired',
    targetOrgId: organizationId,
    targetEntityType: 'office_tasks',
    targetEntityId: taskId,
    reason: `Force-cancelled office task — ${reason}`,
  });

  revalidatePath('/dev/office-tasks');
}
