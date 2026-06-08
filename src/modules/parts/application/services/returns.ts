import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { partReturnLines } from '@/db/schemas/parts/part-return-lines';
import { partReturns } from '@/db/schemas/parts/part-returns';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import type { PartReturn, PartReturnLine } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Returns — send parts back to a supplier (docs/03-data-model.md). Each line
 * links back to the PO line it reverses. A wrong/damaged/defective return
 * re-opens the requirement for re-sourcing; a surplus/no-longer-needed return
 * does not. The supplier credit note settles the money (Sprint 13).
 * `parts:order` required.
 */

export interface ReturnLineInput {
  purchaseOrderLineId: string;
  partRequirementId?: string | null;
  quantityReturned: number;
  reason: PartReturnLine['reason'];
}

export interface CreateReturnInput {
  supplierId: string;
  returnNumber?: string;
  lines: ReturnLineInput[];
  note?: string;
}

const RESOURCING_REASONS: ReadonlySet<PartReturnLine['reason']> = new Set([
  'wrong_part',
  'damaged',
  'defective',
]);

export async function createPartReturn(
  ctx: RequestContext,
  input: CreateReturnInput,
): Promise<PartReturn> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const insertedReturn = await tx
      .insert(partReturns)
      .values({
        organizationId: ctx.organizationId,
        supplierId: input.supplierId,
        returnNumber: input.returnNumber ?? null,
        status: 'requested',
        initiatedByUserId: ctx.userId,
        note: input.note ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const ret = insertedReturn[0];
    if (!ret) throw new Error('Failed to create part return');

    for (const line of input.lines) {
      const poLineRows = await tx
        .select()
        .from(purchaseOrderLines)
        .where(
          and(
            eq(purchaseOrderLines.id, line.purchaseOrderLineId),
            eq(purchaseOrderLines.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      const poLine = poLineRows[0];
      if (!poLine) throw new Error('PO_LINE_NOT_FOUND');

      await tx.insert(partReturnLines).values({
        organizationId: ctx.organizationId,
        partReturnId: ret.id,
        purchaseOrderLineId: poLine.id,
        partRequirementId: line.partRequirementId ?? poLine.partRequirementId,
        quantityReturned: String(line.quantityReturned),
        reason: line.reason,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      const requirementId =
        line.partRequirementId ?? poLine.partRequirementId ?? null;
      if (requirementId && poLine.caseId) {
        // Re-open for re-sourcing only when the part was unusable.
        if (RESOURCING_REASONS.has(line.reason)) {
          await tx
            .update(partRequirements)
            .set({
              status: 'returned',
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(partRequirements.id, requirementId),
                eq(partRequirements.organizationId, ctx.organizationId),
              ),
            );
        }
        await appendLifecycleEvent(tx, ctx, {
          partRequirementId: requirementId,
          caseId: poLine.caseId,
          kind: 'returned',
          detail: { quantity: line.quantityReturned, reason: line.reason },
        });
      }
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'part_returns',
      entityId: ret.id,
      after: { supplierId: input.supplierId, lineCount: input.lines.length },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.return.created',
      payload: { returnId: ret.id, supplierId: input.supplierId },
    });

    return ret;
  });
}
