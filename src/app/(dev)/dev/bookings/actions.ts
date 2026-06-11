'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import { repairStuckBooking } from '@/modules/platform/public';

/**
 * Dev repair: force-cancel a stuck booking (platform-only, audited). Guarded by
 * `requirePlatformAccess`; recorded to `platform_audit_events` (data_repaired).
 */
export async function repairStuckBookingAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const organizationId = String(formData.get('organizationId') ?? '').trim();
  const bookingId = String(formData.get('bookingId') ?? '').trim();
  const reason = String(
    formData.get('reason') ?? 'Force-cancelled via /dev/bookings',
  ).trim();
  if (!organizationId || !bookingId) return;

  await repairStuckBooking(organizationId, bookingId, reason);

  await recordPlatformAudit(ctx, {
    action: 'data_repaired',
    targetOrgId: organizationId,
    targetEntityType: 'case_bookings',
    targetEntityId: bookingId,
    reason: `Force-cancelled booking — ${reason}`,
  });

  revalidatePath('/dev/bookings');
}
