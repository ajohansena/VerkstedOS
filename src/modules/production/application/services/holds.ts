import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { productionHolds } from '@/db/schemas/production/production-holds';
import type { ProductionHold } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Production holds (docs/10-production-domain.md § Waiting states). A hold is a
 * first-class pause; it accompanies a `waiting`-category state. Permission:
 * `production:transition` (holds are part of moving the case through waiting).
 */

export async function createHold(
  ctx: RequestContext,
  input: {
    caseId: string;
    holdKind: ProductionHold['holdKind'];
    reason?: string;
    expectedResolutionAt?: Date | null;
  },
): Promise<ProductionHold> {
  await requirePermission(ctx, 'production:transition');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(productionHolds)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        holdKind: input.holdKind,
        reason: input.reason ?? null,
        expectedResolutionAt: input.expectedResolutionAt ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const hold = inserted[0];
    if (!hold) throw new Error('Failed to create hold');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'production_holds',
      entityId: hold.id,
      after: { caseId: input.caseId, holdKind: input.holdKind },
    });

    await emitEvent(tx, ctx, {
      eventType: 'production.hold.created',
      payload: {
        caseId: input.caseId,
        holdId: hold.id,
        holdKind: input.holdKind,
      },
    });

    return hold;
  });
}

export async function resolveHold(
  ctx: RequestContext,
  holdId: string,
  resolutionNote?: string,
): Promise<void> {
  await requirePermission(ctx, 'production:transition');

  await withTransaction(ctx, async (tx) => {
    await tx
      .update(productionHolds)
      .set({
        resolvedAt: new Date(),
        resolvedByUserId: ctx.userId,
        resolutionNote: resolutionNote ?? null,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productionHolds.id, holdId),
          eq(productionHolds.organizationId, ctx.organizationId),
        ),
      );

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'production_holds',
      entityId: holdId,
      reason: resolutionNote ?? 'Hold resolved',
      after: { resolved: true },
    });

    await emitEvent(tx, ctx, {
      eventType: 'production.hold.resolved',
      payload: { holdId },
    });
  });
}
