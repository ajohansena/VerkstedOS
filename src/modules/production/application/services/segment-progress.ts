import { and, eq, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { timeEntries } from '@/db/schemas/workforce/time-entries';
import { workSegments } from '@/db/schemas/production/work-segments';
import type { WorkSegment } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { segmentRemainingMinutes } from '../calculations/capacity';

/**
 * Segment-driven production progress — THE Sprint 10 guardrail activation
 * (docs/10-production-domain.md; verification risk 3).
 *
 * Status is DERIVED from actual work activity, not hand-maintained:
 *   - `markSegmentActive`  — a technician clocking into a segment moves it to
 *     `in_progress` and stamps `actual_start_at`. Called from the workforce
 *     clock-in path (segment_code → work segment).
 *   - `completeSegment`    — marks a segment `completed`, recomputes
 *     `actual_minutes` from time entries, and emits
 *     `production.segment.completed` — the event that drives the case's status
 *     PROJECTION via the workflow transition machine (event_driven transitions).
 *
 * Permission: `production:transition` (this is production progress, same as a
 * state move).
 */

/** Move a segment to in_progress (idempotent) — driven by clock-in. */
export async function markSegmentActive(
  ctx: RequestContext,
  segmentId: string,
): Promise<WorkSegment | null> {
  return withTransaction(ctx, async (tx) => {
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
    const segment = rows[0];
    if (!segment) return null;
    if (segment.status === 'in_progress') return segment;

    const updated = await tx
      .update(workSegments)
      .set({
        status: 'in_progress',
        actualStartAt: segment.actualStartAt ?? new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(workSegments.id, segmentId))
      .returning();

    await emitEvent(tx, ctx, {
      eventType: 'production.segment.started',
      payload: {
        caseId: segment.caseId,
        segmentId,
        segmentCode: segment.segmentCode,
      },
    });

    return updated[0] ?? segment;
  });
}

/**
 * Complete a segment. Recomputes actual_minutes from time entries, sets
 * remaining to 0, and emits production.segment.completed — the driver event for
 * status projection.
 */
export async function completeSegment(
  ctx: RequestContext,
  segmentId: string,
): Promise<void> {
  await requirePermission(ctx, 'production:transition');

  await withTransaction(ctx, async (tx) => {
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
    const segment = rows[0];
    if (!segment) throw new Error('SEGMENT_NOT_FOUND');

    // Recompute actual minutes from time entries on this segment.
    const sums = await tx
      .select({
        total: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, ctx.organizationId),
          eq(timeEntries.workSegmentId, segmentId),
        ),
      );
    const actualMinutes = sums[0]?.total ?? segment.actualMinutes;

    await tx
      .update(workSegments)
      .set({
        status: 'completed',
        actualMinutes,
        remainingMinutesEstimate: 0,
        actualEndAt: new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(workSegments.id, segmentId));

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'work_segments',
      entityId: segmentId,
      reason: 'Segment completed',
      after: { status: 'completed', actualMinutes },
    });

    // The driver event — consumed to advance the case status projection.
    await emitEvent(tx, ctx, {
      eventType: 'production.segment.completed',
      payload: {
        caseId: segment.caseId,
        segmentId,
        segmentCode: segment.segmentCode,
        actualMinutes,
      },
    });
  });
}

/** Recompute remaining minutes on a segment from its planned/actual (helper). */
export function recomputeRemaining(segment: {
  plannedMinutes: number;
  actualMinutes: number;
}): number {
  return segmentRemainingMinutes(segment);
}
