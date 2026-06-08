import { and, eq, lt, gt, ne, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { resourceAssignments } from '@/db/schemas/production/resource-assignments';
import type { ResourceAssignment } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Resource assignment + conflict detection (docs/10-production-domain.md).
 * Conflicts (overlapping confirmed assignments on the same resource) are
 * SURFACED, never silently overwritten. Permission: `production:plan`.
 */

export interface AssignInput {
  workSegmentId: string;
  resourceId: string;
  role?: ResourceAssignment['role'];
  plannedStartAt: Date;
  plannedEndAt: Date;
  /** Allow overbooking despite a detected conflict (records the override). */
  allowConflict?: boolean;
}

export class ResourceConflictError extends Error {
  readonly code = 'RESOURCE_CONFLICT';
  constructor(readonly resourceId: string) {
    super(`Resource ${resourceId} has an overlapping assignment.`);
    this.name = 'ResourceConflictError';
  }
}

export async function assignResource(
  ctx: RequestContext,
  input: AssignInput,
): Promise<ResourceAssignment> {
  await requirePermission(ctx, 'production:plan');

  return withTransaction(ctx, async (tx) => {
    // Conflict = another active assignment on the same resource whose window
    // overlaps [plannedStartAt, plannedEndAt).
    const overlapping = await tx
      .select({ id: resourceAssignments.id })
      .from(resourceAssignments)
      .where(
        and(
          eq(resourceAssignments.organizationId, ctx.organizationId),
          eq(resourceAssignments.resourceId, input.resourceId),
          ne(resourceAssignments.status, 'cancelled'),
          isNull(resourceAssignments.deletedAt),
          lt(resourceAssignments.plannedStartAt, input.plannedEndAt),
          gt(resourceAssignments.plannedEndAt, input.plannedStartAt),
        ),
      )
      .limit(1);

    const hasConflict = overlapping.length > 0;
    if (hasConflict && !input.allowConflict) {
      throw new ResourceConflictError(input.resourceId);
    }

    const inserted = await tx
      .insert(resourceAssignments)
      .values({
        organizationId: ctx.organizationId,
        workSegmentId: input.workSegmentId,
        resourceId: input.resourceId,
        role: input.role ?? 'primary',
        plannedStartAt: input.plannedStartAt,
        plannedEndAt: input.plannedEndAt,
        status: 'planned',
        conflictResolvedAt: hasConflict ? new Date() : null,
        conflictOverrideByUserId: hasConflict ? ctx.userId : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const assignment = inserted[0];
    if (!assignment) throw new Error('Failed to assign resource');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'resource_assignments',
      entityId: assignment.id,
      after: {
        workSegmentId: input.workSegmentId,
        resourceId: input.resourceId,
        conflictOverride: hasConflict,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'production.segment.assigned',
      payload: {
        segmentId: input.workSegmentId,
        resourceId: input.resourceId,
        assignmentId: assignment.id,
        conflictOverride: hasConflict,
      },
    });

    return assignment;
  });
}

/** List assignments for a work segment. */
export async function listAssignments(
  ctx: RequestContext,
  workSegmentId: string,
): Promise<ResourceAssignment[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(resourceAssignments)
      .where(
        and(
          eq(resourceAssignments.organizationId, ctx.organizationId),
          eq(resourceAssignments.workSegmentId, workSegmentId),
          isNull(resourceAssignments.deletedAt),
        ),
      );
  });
}
