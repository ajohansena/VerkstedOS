'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import { transitionState } from '@/modules/production/public';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Server action — drag-to-transition from the Production Board v2 (Track D).
 *
 * Delegates to the SSoT `transitionState` (permission-gated by
 * `production:transition`, history-driven). Revalidates the board and the
 * affected case page so optimistic UI re-confirms against fresh data.
 */
export async function transitionCaseAction(input: {
  caseId: string;
  toStateCode: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    await transitionState(session.context, {
      caseId: input.caseId,
      toStateCode: input.toStateCode,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      trigger: 'manual',
    });
    revalidatePath('/production');
    revalidatePath('/');
    revalidatePath(`/cases/${input.caseId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    return { ok: false, error: msg };
  }
}
