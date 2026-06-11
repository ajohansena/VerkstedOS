import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Unified planner read model — `listPlannerRowsForRange` (Sprint 22 Phase D,
 * doc 13 § 20.4).
 *
 * The planner consumes a single read model that unions `case_bookings` and
 * `work_segments`+`resource_assignments` so that bookings appear in Day/Week
 * the moment they are created — not only after segments are planned.
 *
 * Validates against real Postgres:
 *   • Case with only a booking returns `lifecycle: 'booked'` and segments: [].
 *   • Case with planned segments returns `lifecycle: 'in_progress'` with the
 *     segment summaries; booking (if any) is attached as context.
 *   • Cancelled bookings are excluded.
 *   • Out-of-range bookings are excluded.
 *   • Cross-org isolation: org B never sees org A's planner rows.
 */
describe('planner rows composer (Phase D)', () => {
  let h: IsolationHarness;
  let production: typeof import('@/modules/production/public');
  let workforce: typeof import('@/modules/workforce/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgAId: string;
  let orgBId: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let workshopAId: string;
  let workshopBId: string;

  // Three cases in org A: booked-only, planned (no booking), planned + booking.
  let bookedOnlyCaseId: string;
  let bookedOnlyCaseNumber: string;
  let plannedCaseId: string;
  let plannedCaseNumber: string;
  let plannedAndBookedCaseId: string;
  let plannedAndBookedCaseNumber: string;
  let cancelledBookingCaseId: string;
  let outOfRangeBookingCaseId: string;
  // One case in org B.
  let crossOrgCaseId: string;

  // Range: today at 00:00 → today + 7 days.
  const DAY = 86_400_000;
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart.getTime() + 7 * DAY);
  const insideRange = new Date(rangeStart.getTime() + 2 * DAY);
  const outsideRange = new Date(rangeStart.getTime() + 30 * DAY);

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    production = await import('@/modules/production/public');
    workforce = await import('@/modules/workforce/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerAUserId = '00000000-0000-0000-0000-0000000d4a01';
    ownerBUserId = '00000000-0000-0000-0000-0000000d4b01';
    await identity.ensureUser({
      id: ownerAUserId,
      email: 'd4-owner-a@example.no',
      fullName: 'D4 Owner A',
    });
    await identity.ensureUser({
      id: ownerBUserId,
      email: 'd4-owner-b@example.no',
      fullName: 'D4 Owner B',
    });
    const a = await identity.createOrganizationWithOwner({
      name: 'D4 Workshop A',
      ownerUserId: ownerAUserId,
    });
    const b = await identity.createOrganizationWithOwner({
      name: 'D4 Workshop B',
      ownerUserId: ownerBUserId,
    });
    orgAId = a.organization.id;
    orgBId = b.organization.id;

    await production.seedDefaultWorkflow(orgAId);
    await production.seedDefaultWorkflow(orgBId);

    const [wsA] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgAId}, 'D4 Bergen') RETURNING id
    `;
    workshopAId = wsA!['id'] as string;
    const [wsB] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgBId}, 'D4 Stavanger') RETURNING id
    `;
    workshopBId = wsB!['id'] as string;

    // --- Org A fixtures ---
    const bookedOnly = await caseModule.createCase(ctxA(), {
      fundingSources: [],
    });
    bookedOnlyCaseId = bookedOnly.id;
    bookedOnlyCaseNumber = bookedOnly.caseNumber;
    await caseModule.createBooking(ctxA(), {
      caseId: bookedOnlyCaseId,
      workshopId: workshopAId,
      expectedArrivalAt: insideRange,
      confirmImmediately: true,
    });

    // Planned-only: add a work segment + resource assignment inside the range.
    const planned = await caseModule.createCase(ctxA(), { fundingSources: [] });
    plannedCaseId = planned.id;
    plannedCaseNumber = planned.caseNumber;
    const seg1 = await production.addWorkSegment(ctxA(), {
      caseId: plannedCaseId,
      segmentCode: 'paint_preparation',
      plannedMinutes: 120,
    });
    const [resA] = await h.admin`
      INSERT INTO resources (organization_id, kind, name, created_by, updated_by)
      VALUES (${orgAId}, 'person', 'D4 Tech A', ${ownerAUserId}, ${ownerAUserId})
      RETURNING id
    `;
    const resourceAId = resA!['id'] as string;
    await production.assignResource(ctxA(), {
      workSegmentId: seg1.id,
      resourceId: resourceAId,
      plannedStartAt: new Date(rangeStart.getTime() + 1 * DAY + 9 * 3600_000),
      plannedEndAt: new Date(rangeStart.getTime() + 1 * DAY + 11 * 3600_000),
    });

    // Planned + booked: both signals present.
    const both = await caseModule.createCase(ctxA(), { fundingSources: [] });
    plannedAndBookedCaseId = both.id;
    plannedAndBookedCaseNumber = both.caseNumber;
    await caseModule.createBooking(ctxA(), {
      caseId: plannedAndBookedCaseId,
      workshopId: workshopAId,
      expectedArrivalAt: new Date(rangeStart.getTime() + 3 * DAY),
      confirmImmediately: true,
    });
    const seg2 = await production.addWorkSegment(ctxA(), {
      caseId: plannedAndBookedCaseId,
      segmentCode: 'paint_preparation',
      plannedMinutes: 60,
    });
    await production.assignResource(ctxA(), {
      workSegmentId: seg2.id,
      resourceId: resourceAId,
      plannedStartAt: new Date(rangeStart.getTime() + 3 * DAY + 13 * 3600_000),
      plannedEndAt: new Date(rangeStart.getTime() + 3 * DAY + 14 * 3600_000),
    });

    // Cancelled booking — must not appear.
    const cancelled = await caseModule.createCase(ctxA(), {
      fundingSources: [],
    });
    cancelledBookingCaseId = cancelled.id;
    const cancelledBooking = await caseModule.createBooking(ctxA(), {
      caseId: cancelledBookingCaseId,
      workshopId: workshopAId,
      expectedArrivalAt: insideRange,
    });
    await caseModule.cancelBooking(
      ctxA(),
      cancelledBooking.id,
      'integration test',
    );

    // Booking outside the range — must not appear.
    const outOfRange = await caseModule.createCase(ctxA(), {
      fundingSources: [],
    });
    outOfRangeBookingCaseId = outOfRange.id;
    await caseModule.createBooking(ctxA(), {
      caseId: outOfRangeBookingCaseId,
      workshopId: workshopAId,
      expectedArrivalAt: outsideRange,
    });

    // --- Org B fixture: tenant-isolation check ---
    const crossOrg = await caseModule.createCase(ctxB(), {
      fundingSources: [],
    });
    crossOrgCaseId = crossOrg.id;
    await caseModule.createBooking(ctxB(), {
      caseId: crossOrgCaseId,
      workshopId: workshopBId,
      expectedArrivalAt: insideRange,
      confirmImmediately: true,
    });

    // Force a planning use to ensure the workforce import is exercised
    // (avoids unused-binding lint friction without introducing dead code).
    void workforce;
  }, 180_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctxA() {
    return {
      userId: ownerAUserId,
      organizationId: orgAId,
      workshopId: workshopAId,
      accessibleWorkshopIds: [workshopAId] as string[],
      correlationId: '00000000-0000-0000-0000-0000000d4a99',
    };
  }
  function ctxB() {
    return {
      userId: ownerBUserId,
      organizationId: orgBId,
      workshopId: workshopBId,
      accessibleWorkshopIds: [workshopBId] as string[],
      correlationId: '00000000-0000-0000-0000-0000000d4b99',
    };
  }

  it('returns booked-only cases with lifecycle="booked" and empty segments', async () => {
    const rows = await production.listPlannerRowsForRange(
      ctxA(),
      rangeStart,
      rangeEnd,
    );
    const row = rows.find((r) => r.caseId === bookedOnlyCaseId);
    expect(row).toBeDefined();
    expect(row!.caseNumber).toBe(bookedOnlyCaseNumber);
    expect(row!.lifecycle).toBe('booked');
    expect(row!.segments).toEqual([]);
    expect(row!.booking).not.toBeNull();
    expect(row!.booking!.status).toBe('confirmed');
    expect(row!.anchor?.getTime()).toBe(insideRange.getTime());
  });

  it('returns planned-only cases with lifecycle="in_progress" and segment summaries', async () => {
    const rows = await production.listPlannerRowsForRange(
      ctxA(),
      rangeStart,
      rangeEnd,
    );
    const row = rows.find((r) => r.caseId === plannedCaseId);
    expect(row).toBeDefined();
    expect(row!.caseNumber).toBe(plannedCaseNumber);
    expect(row!.lifecycle).toBe('in_progress');
    expect(row!.segments.length).toBeGreaterThan(0);
    expect(row!.booking).toBeNull();
  });

  it('returns planned + booked cases as a single row with lifecycle="in_progress" and booking attached', async () => {
    const rows = await production.listPlannerRowsForRange(
      ctxA(),
      rangeStart,
      rangeEnd,
    );
    const row = rows.find((r) => r.caseId === plannedAndBookedCaseId);
    expect(row).toBeDefined();
    expect(row!.caseNumber).toBe(plannedAndBookedCaseNumber);
    // Continuous lifecycle: card morphs but caseId is stable and the booking
    // remains visible alongside the segment instead of being replaced.
    expect(row!.lifecycle).toBe('in_progress');
    expect(row!.segments.length).toBeGreaterThan(0);
    expect(row!.booking).not.toBeNull();
    expect(row!.booking!.status).toBe('confirmed');
  });

  it('excludes cancelled bookings and bookings outside the range', async () => {
    const rows = await production.listPlannerRowsForRange(
      ctxA(),
      rangeStart,
      rangeEnd,
    );
    const ids = rows.map((r) => r.caseId);
    expect(ids).not.toContain(cancelledBookingCaseId);
    expect(ids).not.toContain(outOfRangeBookingCaseId);
  });

  it('enforces tenant isolation: org B sees only its own row', async () => {
    const aRows = await production.listPlannerRowsForRange(
      ctxA(),
      rangeStart,
      rangeEnd,
    );
    const bRows = await production.listPlannerRowsForRange(
      ctxB(),
      rangeStart,
      rangeEnd,
    );
    const aIds = aRows.map((r) => r.caseId);
    const bIds = bRows.map((r) => r.caseId);
    expect(aIds).not.toContain(crossOrgCaseId);
    expect(bIds).toContain(crossOrgCaseId);
    expect(bIds).not.toContain(bookedOnlyCaseId);
    expect(bIds).not.toContain(plannedCaseId);
  });
});
