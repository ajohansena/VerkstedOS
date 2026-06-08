import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { productionOrders } from '@/db/schemas/production/production-orders';
import { workSegments } from '@/db/schemas/production/work-segments';
import { segmentCatalogEntry } from '@/lib/seed/work-segment-catalog';
import type { WorkSegment } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { ensureProductionOrder } from './transition-machine';

/**
 * Work-segment management (docs/10-production-domain.md). Segments are created
 * per case from the catalog (and, in practice, from estimate operations). Small
 * repairs add a few; large repairs add many — nothing is mandatory.
 *
 * Permission: `production:plan`.
 */

export async function addWorkSegment(
  ctx: RequestContext,
  input: {
    caseId: string;
    segmentCode: string;
    label?: string;
    plannedMinutes?: number;
    plannedWorkshopId?: string | null;
    defaultFundingSourceId?: string | null;
  },
): Promise<WorkSegment> {
  await requirePermission(ctx, 'production:plan');

  // Ensure the container exists (idempotent).
  const order = await ensureProductionOrder(ctx, input.caseId);
  const catalog = segmentCatalogEntry(input.segmentCode);

  return withTransaction(ctx, async (tx) => {
    // Next sequence number for the case.
    const existing = await tx
      .select({ seq: workSegments.sequenceNo })
      .from(workSegments)
      .where(
        and(
          eq(workSegments.organizationId, ctx.organizationId),
          eq(workSegments.caseId, input.caseId),
        ),
      );
    const nextSeq = existing.reduce((max, r) => Math.max(max, r.seq), -1) + 1;

    const planned = input.plannedMinutes ?? 0;
    const inserted = await tx
      .insert(workSegments)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        productionOrderId: order.id,
        segmentCode: input.segmentCode,
        label: input.label ?? catalog?.label ?? input.segmentCode,
        sequenceNo: nextSeq,
        plannedWorkshopId: input.plannedWorkshopId ?? ctx.workshopId ?? null,
        requiredSkills: (catalog?.requiredSkills ?? []) as never,
        requiredEquipmentKinds: (catalog?.requiredEquipmentKinds ??
          []) as never,
        plannedMinutes: planned,
        remainingMinutesEstimate: planned,
        defaultFundingSourceId: input.defaultFundingSourceId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const segment = inserted[0];
    if (!segment) throw new Error('Failed to create work segment');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'work_segments',
      entityId: segment.id,
      after: { caseId: input.caseId, segmentCode: input.segmentCode },
    });

    await emitEvent(tx, ctx, {
      eventType: 'production.segment.created',
      payload: {
        caseId: input.caseId,
        segmentId: segment.id,
        segmentCode: input.segmentCode,
      },
    });

    return segment;
  });
}

/** List a case's work segments in sequence. */
export async function listWorkSegments(
  ctx: RequestContext,
  caseId: string,
): Promise<WorkSegment[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(workSegments)
      .where(
        and(
          eq(workSegments.organizationId, ctx.organizationId),
          eq(workSegments.caseId, caseId),
          isNull(workSegments.deletedAt),
        ),
      )
      .orderBy(workSegments.sequenceNo);
  });
}

/** Internal: load a single segment within a transaction. */
export async function loadSegment(
  tx: TenantTransaction,
  ctx: RequestContext,
  segmentId: string,
): Promise<WorkSegment | null> {
  const rows = await tx
    .select()
    .from(workSegments)
    .where(
      and(
        eq(workSegments.id, segmentId),
        eq(workSegments.organizationId, ctx.organizationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Re-export the table for sibling services that compose within one transaction.
export { workSegments, productionOrders };
