import type { TenantTransaction } from '@/db/client';
import { partLifecycleEvents } from '@/db/schemas/parts/part-lifecycle-events';
import type { PartLifecycleEvent } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Append a row to the part lifecycle timeline projection (the UI consumes it).
 * Called WITHIN a parts mutation transaction, alongside the audit + outbox
 * writes, so the timeline is consistent with the authoritative state. The table
 * is append-only at the RLS level.
 */
export type LifecycleKind = PartLifecycleEvent['kind'];

export async function appendLifecycleEvent(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    partRequirementId: string;
    caseId: string;
    kind: LifecycleKind;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(partLifecycleEvents).values({
    organizationId: ctx.organizationId,
    partRequirementId: input.partRequirementId,
    caseId: input.caseId,
    kind: input.kind,
    detail: (input.detail ?? null) as never,
    actorUserId: ctx.userId,
  });
}
