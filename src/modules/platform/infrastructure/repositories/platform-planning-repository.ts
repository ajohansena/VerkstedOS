import { and, desc, eq, sql } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { workSegments } from '@/db/schemas/production/work-segments';
import { timeEntries } from '@/db/schemas/workforce/time-entries';

/**
 * Production planning inspection + repair (Dev surface, /dev/production).
 * Cross-org → service-role connection.
 *
 * The recompute tool re-derives a segment's actual_minutes from its tagged time
 * entries — the SAME derivation `completeSegment` uses — so a drifted projection
 * can be repaired without ad-hoc SQL.
 */

export interface SegmentRow {
  readonly id: string;
  readonly caseId: string;
  readonly label: string;
  readonly status: string;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly remainingMinutesEstimate: number | null;
}

export async function listSegmentsForOrg(
  organizationId: string,
  limit = 100,
): Promise<SegmentRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: workSegments.id,
      caseId: workSegments.caseId,
      label: workSegments.label,
      status: workSegments.status,
      plannedMinutes: workSegments.plannedMinutes,
      actualMinutes: workSegments.actualMinutes,
      remainingMinutesEstimate: workSegments.remainingMinutesEstimate,
    })
    .from(workSegments)
    .where(eq(workSegments.organizationId, organizationId))
    .orderBy(desc(workSegments.createdAt))
    .limit(limit);
}

export interface RecomputeResult {
  readonly segmentId: string;
  readonly before: number;
  readonly after: number;
}

/**
 * Re-derive actual_minutes for a segment from its time entries. Read-then-write
 * via the platform connection; returns before/after for the audit trail. The
 * derivation matches the canonical `completeSegment` path.
 */
export async function recomputeSegmentActuals(
  organizationId: string,
  segmentId: string,
): Promise<RecomputeResult> {
  const db = getRawClient({ as: 'platform-inspector' });

  const current = await db
    .select({ actualMinutes: workSegments.actualMinutes })
    .from(workSegments)
    .where(
      and(
        eq(workSegments.id, segmentId),
        eq(workSegments.organizationId, organizationId),
      ),
    )
    .limit(1);
  const before = current[0]?.actualMinutes ?? 0;

  const sums = await db
    .select({
      total: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.organizationId, organizationId),
        eq(timeEntries.workSegmentId, segmentId),
      ),
    );
  const after = sums[0]?.total ?? before;

  await db
    .update(workSegments)
    .set({ actualMinutes: after, updatedAt: new Date() })
    .where(
      and(
        eq(workSegments.id, segmentId),
        eq(workSegments.organizationId, organizationId),
      ),
    );

  return { segmentId, before, after };
}
