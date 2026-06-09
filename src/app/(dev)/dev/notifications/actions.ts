'use server';

import { revalidatePath } from 'next/cache';

import { runWithContext } from '@/lib/tenancy/context';
import { evaluateNotificationRules } from '@/modules/notifications/public';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Dev surface action — manually run the notification engine for one org. Same
 * code path as the scheduled cron (no ad-hoc SQL), so the result is equivalent
 * to "what would happen at the next 15-min tick" (CLAUDE.md § 6).
 *
 * Access is enforced by the (dev) layout guard.
 */
export async function evaluateForOrg(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('org') ?? '');
  if (!organizationId) return;
  const ctx = {
    userId: SYSTEM_USER_ID,
    organizationId,
    workshopId: null,
    accessibleWorkshopIds: [] as string[],
    correlationId: `dev-eval-${organizationId}-${Date.now()}`,
  };
  await runWithContext(ctx, () => evaluateNotificationRules(ctx));
  revalidatePath(`/dev/notifications`);
}
