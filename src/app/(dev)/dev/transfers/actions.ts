'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import { repairStuckTransfer } from '@/modules/platform/public';

/**
 * Dev repair: force-cancel a stuck transfer (platform-only, audited). Guarded by
 * requirePlatformAccess; recorded to platform_audit_events (data_repaired).
 */
export async function repairStuckTransferAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const organizationId = String(formData.get('organizationId') ?? '').trim();
  const transferId = String(formData.get('transferId') ?? '').trim();
  if (!organizationId || !transferId) return;

  await repairStuckTransfer(organizationId, transferId);

  await recordPlatformAudit(ctx, {
    action: 'data_repaired',
    targetOrgId: organizationId,
    targetEntityType: 'case_transfers',
    targetEntityId: transferId,
    reason: 'Force-cancelled a stuck transfer',
  });

  revalidatePath('/dev/transfers');
}
