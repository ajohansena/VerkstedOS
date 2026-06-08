'use server';

import { revalidatePath } from 'next/cache';

import { rebuildRequirementStatus } from '@/modules/platform/public';

/**
 * Rebuild a part requirement's status from its actual quantities (Dev repair).
 * Same reconciliation calculation as customer code — no ad-hoc SQL. The
 * hardened /dev guard is applied by the (dev) layout; this is platform-only.
 */
export async function rebuildRequirementAction(
  formData: FormData,
): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const requirementId = String(formData.get('requirementId') ?? '');
  if (organizationId && requirementId) {
    await rebuildRequirementStatus(organizationId, requirementId);
  }
  revalidatePath('/dev/parts');
}
