import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { estimateOperations } from '@/db/schemas/estimating/estimate-operations';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Per-line funding allocation (docs/03 billable-line tagging). An estimator
 * assigns each operation to a case funding source. Allowed only while the parent
 * import is unlocked — the RLS update policy + this service both enforce that.
 * Requires `estimate:edit`.
 */
export async function allocateOperationFunding(
  ctx: RequestContext,
  input: {
    operationId: string;
    fundingSourceId: string | null;
  },
): Promise<void> {
  await requirePermission(ctx, 'estimate:edit');

  await withTransaction(ctx, async (tx) => {
    // Guard: the parent import must not be locked/superseded.
    const rows = await tx
      .select({ status: estimateImports.status })
      .from(estimateOperations)
      .innerJoin(
        estimateImports,
        eq(estimateImports.id, estimateOperations.estimateImportId),
      )
      .where(
        and(
          eq(estimateOperations.id, input.operationId),
          eq(estimateOperations.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const status = rows[0]?.status;
    if (!status) throw new Error('Operation not found');
    if (status === 'locked' || status === 'superseded') {
      throw new Error('ESTIMATE_LOCKED');
    }

    await tx
      .update(estimateOperations)
      .set({
        fundingSourceId: input.fundingSourceId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(estimateOperations.id, input.operationId),
          eq(estimateOperations.organizationId, ctx.organizationId),
        ),
      );

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'estimate_operations',
      entityId: input.operationId,
      after: { fundingSourceId: input.fundingSourceId },
    });
  });
}
