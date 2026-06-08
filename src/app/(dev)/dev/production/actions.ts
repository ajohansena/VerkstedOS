'use server';

import { revalidatePath } from 'next/cache';

import { recomputeSegmentActuals } from '@/modules/platform/public';

/**
 * Recompute a work segment's actual_minutes from its time entries (Dev repair).
 * Same derivation as the canonical completeSegment path — no ad-hoc SQL. The
 * hardened /dev guard is applied by the (dev) layout; this is platform-only.
 */
export async function recomputeSegmentAction(
  formData: FormData,
): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const segmentId = String(formData.get('segmentId') ?? '');
  if (organizationId && segmentId) {
    await recomputeSegmentActuals(organizationId, segmentId);
  }
  revalidatePath('/dev/production');
}
