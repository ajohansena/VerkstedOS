'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import { repairDisableTaskTemplate } from '@/modules/platform/public';

/**
 * Dev repair: force-disable a runaway task template (platform-only, audited).
 *
 * Used when a template is producing bad office tasks across an org's recent
 * outbox window and the admin team can't reach it in time. Disabling stops
 * future generation; existing bad tasks must be cancelled via
 * /dev/office-tasks.
 */
export async function repairDisableTaskTemplateAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const organizationId = String(formData.get('organizationId') ?? '').trim();
  const templateId = String(formData.get('templateId') ?? '').trim();
  if (!organizationId || !templateId) return;

  await repairDisableTaskTemplate(organizationId, templateId);

  await recordPlatformAudit(ctx, {
    action: 'data_repaired',
    targetOrgId: organizationId,
    targetEntityType: 'task_templates',
    targetEntityId: templateId,
    reason: 'Force-disabled task template via /dev/task-templates',
  });

  revalidatePath('/dev/task-templates');
}
