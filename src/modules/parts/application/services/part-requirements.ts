import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import type { PartRequirement } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Part requirements — the spine (docs/03-data-model.md). A technician flags a
 * needed/missing part; the coordinator sources it. `parts:order` covers
 * creating and managing requirements (a flagged part IS the start of the order
 * flow). `parts:view` is read-only.
 */

export interface FlagPartInput {
  caseId: string;
  description: string;
  partNumber?: string;
  quantity?: number;
  fundingSourceId?: string | null;
  workSegmentId?: string | null;
  unitCostEstimate?: string | null;
  source?: PartRequirement['source'];
  notes?: string;
}

export async function flagPartRequirement(
  ctx: RequestContext,
  input: FlagPartInput,
): Promise<PartRequirement> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(partRequirements)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        source: input.source ?? 'manual',
        partNumber: input.partNumber ?? null,
        description: input.description,
        quantity: input.quantity != null ? String(input.quantity) : '1',
        fundingSourceId: input.fundingSourceId ?? null,
        workSegmentId: input.workSegmentId ?? null,
        unitCostEstimate: input.unitCostEstimate ?? null,
        status: 'needed',
        requestedByUserId: ctx.userId,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const requirement = inserted[0];
    if (!requirement) throw new Error('Failed to create part requirement');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'part_requirements',
      entityId: requirement.id,
      after: { caseId: input.caseId, description: input.description },
    });

    await appendLifecycleEvent(tx, ctx, {
      partRequirementId: requirement.id,
      caseId: input.caseId,
      kind: 'requirement_created',
      detail: {
        description: input.description,
        quantity: requirement.quantity,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.requirement.created',
      payload: {
        caseId: input.caseId,
        requirementId: requirement.id,
        description: input.description,
      },
    });

    return requirement;
  });
}

/** List a case's part requirements. */
export async function listPartRequirements(
  ctx: RequestContext,
  caseId: string,
): Promise<PartRequirement[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          eq(partRequirements.caseId, caseId),
          isNull(partRequirements.deletedAt),
        ),
      )
      .orderBy(partRequirements.createdAt);
  });
}

/** Cancel a requirement (e.g. no longer needed). */
export async function cancelPartRequirement(
  ctx: RequestContext,
  requirementId: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'parts:order');

  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.id, requirementId),
          eq(partRequirements.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const requirement = rows[0];
    if (!requirement) throw new Error('REQUIREMENT_NOT_FOUND');

    await tx
      .update(partRequirements)
      .set({
        status: 'cancelled',
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(partRequirements.id, requirementId));

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'part_requirements',
      entityId: requirementId,
      reason,
      after: { status: 'cancelled' },
    });

    await appendLifecycleEvent(tx, ctx, {
      partRequirementId: requirementId,
      caseId: requirement.caseId,
      kind: 'cancelled',
      detail: { reason },
    });
  });
}
