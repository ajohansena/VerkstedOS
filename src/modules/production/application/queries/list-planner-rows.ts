import {
  listActiveBookingsForOrgInRange,
  type ActiveBookingForPlanner,
} from '@/modules/case/public';
import type { RequestContext } from '@/lib/tenancy/context';

import {
  listPlannedSegmentsForRange,
  type PlannedSegmentRow,
} from '../../infrastructure/repositories/production-repository';

/**
 * Unified planner read model (Sprint 22 Phase D, doc 13 § 20.4 binding).
 *
 * One row per case representing where that case is in its lifecycle as seen
 * by the planner. The same logical card is rendered by Day, Week and Resource
 * views — it never disappears or gets replaced as planning progresses. The
 * card morphs:
 *
 *   booked          (booking exists, no segments yet)
 *      ↓
 *   in_progress     (segments exist; booking still visible as context)
 *
 * The two persistence models (`case_bookings`, `work_segments` +
 * `resource_assignments`) stay separate behind this composer — the boundary
 * is a UX one: the planner consumes `PlannerRow`, not the raw tables.
 *
 * Per project-owner direction (Phase D design call):
 * - Booked-only rows are NOT visually de-emphasized.
 * - Booked-only rows appear in Day + Week (workshop-operations focus).
 * - Booked-only rows do NOT appear in Resource mode (per-resource focus).
 * - Booked-only rows do NOT consume forecast capacity (no labour estimate).
 *   The page surfaces an unplanned-bookings banner instead of inventing data.
 */
export type PlannerLifecycle = 'booked' | 'in_progress';

export interface PlannerSegmentSummary {
  assignmentId: string;
  segmentId: string;
  segmentLabel: string | null;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  status: string;
}

export interface PlannerBookingSummary {
  bookingId: string;
  workshopId: string;
  status: 'tentative' | 'confirmed' | 'arrived';
  expectedArrivalAt: Date | null;
  promisedDeliveryAt: Date | null;
}

export interface PlannerRow {
  caseId: string;
  caseNumber: string;
  /** `booked` = no segments in the range; `in_progress` = at least one segment. */
  lifecycle: PlannerLifecycle;
  booking: PlannerBookingSummary | null;
  segments: PlannerSegmentSummary[];
  /**
   * Timeline anchor — when the card "sits" on the calendar. For booked-only
   * rows this is `booking.expectedArrivalAt`; for in-progress rows this is
   * the earliest planned segment start; null only when neither is known.
   */
  anchor: Date | null;
}

/**
 * Compose planner rows for the given range. Reads bookings (case module) and
 * planned segments (production module) and unions them per case. Pure
 * read-orchestration — no writes, no side effects.
 *
 * `segments` only includes assignments whose planned start falls inside the
 * range (matching `listPlannedSegmentsForRange`). A case can therefore appear
 * as `booked` here even if it has segments planned for a different week —
 * which is exactly what we want for Day/Week ("nothing planned today, but
 * booked to arrive today").
 */
export async function listPlannerRowsForRange(
  ctx: RequestContext,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<PlannerRow[]> {
  const [segments, bookings] = await Promise.all([
    listPlannedSegmentsForRange(ctx, rangeStart, rangeEnd),
    listActiveBookingsForOrgInRange(ctx, {
      from: rangeStart,
      to: rangeEnd,
    }),
  ]);

  const rowsByCase = new Map<string, PlannerRow>();

  for (const s of segments) {
    appendSegment(rowsByCase, s);
  }
  for (const b of bookings) {
    mergeBooking(rowsByCase, b);
  }

  // Sort by anchor ascending (earliest first); null anchors trail.
  return Array.from(rowsByCase.values()).sort(byAnchorAsc);
}

function appendSegment(
  rowsByCase: Map<string, PlannerRow>,
  s: PlannedSegmentRow,
): void {
  const segmentSummary: PlannerSegmentSummary = {
    assignmentId: s.assignmentId,
    segmentId: s.segmentId,
    segmentLabel: s.segmentLabel,
    resourceId: s.resourceId,
    resourceName: s.resourceName,
    resourceKind: s.resourceKind,
    plannedStartAt: s.plannedStartAt,
    plannedEndAt: s.plannedEndAt,
    status: s.status,
  };
  const existing = rowsByCase.get(s.caseId);
  if (existing) {
    existing.segments.push(segmentSummary);
    existing.lifecycle = 'in_progress';
    existing.anchor = earliest(existing.anchor, s.plannedStartAt);
    return;
  }
  rowsByCase.set(s.caseId, {
    caseId: s.caseId,
    caseNumber: s.caseNumber,
    lifecycle: 'in_progress',
    booking: null,
    segments: [segmentSummary],
    anchor: s.plannedStartAt,
  });
}

function mergeBooking(
  rowsByCase: Map<string, PlannerRow>,
  b: ActiveBookingForPlanner,
): void {
  const bookingSummary: PlannerBookingSummary = {
    bookingId: b.bookingId,
    workshopId: b.workshopId,
    status: b.status,
    expectedArrivalAt: b.expectedArrivalAt,
    promisedDeliveryAt: b.promisedDeliveryAt,
  };
  const existing = rowsByCase.get(b.caseId);
  if (existing) {
    // Has segments — keep lifecycle 'in_progress', attach booking as context.
    existing.booking = bookingSummary;
    return;
  }
  rowsByCase.set(b.caseId, {
    caseId: b.caseId,
    caseNumber: b.caseNumber,
    lifecycle: 'booked',
    booking: bookingSummary,
    segments: [],
    anchor: b.expectedArrivalAt,
  });
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

function byAnchorAsc(a: PlannerRow, b: PlannerRow): number {
  if (a.anchor === null && b.anchor === null) {
    return a.caseNumber.localeCompare(b.caseNumber);
  }
  if (a.anchor === null) return 1;
  if (b.anchor === null) return -1;
  return a.anchor.getTime() - b.anchor.getTime();
}
