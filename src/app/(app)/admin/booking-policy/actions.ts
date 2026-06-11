'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import { updateOrganizationSettings } from '@/modules/identity/public';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Save booking policy (default window + overbooking tolerance) to
 * `organizations.settings.bookingPolicy`. Re-uses `admin:config` — no new
 * permission. Mutations audited by `updateOrganizationSettings` (full-audit
 * table). D2 admin surface.
 */
export async function saveBookingPolicyAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const windowDays = Number(
      formData.get('defaultBookingWindowDays') ?? '14',
    );
    const tolerance = Number(
      formData.get('overbookingTolerancePercent') ?? '0',
    );
    if (
      !Number.isFinite(windowDays) ||
      windowDays < 1 ||
      windowDays > 365
    ) {
      return { ok: false, error: 'INVALID_WINDOW_DAYS' };
    }
    if (
      !Number.isFinite(tolerance) ||
      tolerance < 0 ||
      tolerance > 100
    ) {
      return { ok: false, error: 'INVALID_TOLERANCE' };
    }
    await updateOrganizationSettings(session.context, {
      bookingPolicy: {
        defaultBookingWindowDays: Math.floor(windowDays),
        overbookingTolerancePercent: Math.floor(tolerance),
      },
    });
    revalidatePath('/admin/booking-policy');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERROR',
    };
  }
}
