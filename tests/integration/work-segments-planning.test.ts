import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Work segments & planning integration suite (Sprint 10) — GUARDRAIL
 * ACTIVATION.
 *
 * Validates against real Postgres that production STATUS is DERIVED from actual
 * work activity, not hand-maintained (docs/10-production-domain.md; risk 3):
 *
 *   1. work segments are created per case from the catalog
 *   2. capacity is a CALCULATION (SSoT), not a stored flat number
 *   3. a technician CLOCKING INTO a segment moves it to in_progress and stamps
 *      actual_start_at — clock activity drives segment status
 *   4. completing a segment recomputes actual_minutes from the time entries
 *      tagged to that segment, and emits production.segment.completed
 *   5. resource assignment SURFACES conflicts (overlapping confirmed windows)
 *      rather than silently overwriting them
 */
describe('work segments & planning', () => {
  let h: IsolationHarness;
  let production: typeof import('@/modules/production/public');
  let workforce: typeof import('@/modules/workforce/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;
  let employeeId: string;
  let segmentId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    production = await import('@/modules/production/public');
    workforce = await import('@/modules/workforce/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b0';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner10@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Planning Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
    await production.seedDefaultWorkflow(orgId);

    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseId = created.id;

    const employee = await workforce.createEmployee(ctx(), {
      fullName: 'Erik Tekniker',
      skills: [{ skillCode: 'paint', proficiency: 'qualified' }],
    });
    employeeId = employee.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId: null,
      accessibleWorkshopIds: [] as string[],
      correlationId: '00000000-0000-0000-0000-0000000000fa',
    };
  }

  it('creates a work segment from the catalog (planning unit)', async () => {
    const segment = await production.addWorkSegment(ctx(), {
      caseId,
      segmentCode: 'paint_preparation',
      plannedMinutes: 120,
    });
    segmentId = segment.id;

    expect(segment.caseId).toBe(caseId);
    expect(segment.status).toBe('not_started');
    expect(segment.plannedMinutes).toBe(120);
    expect(segment.remainingMinutesEstimate).toBe(120);
    // Catalog supplied the label + required skills.
    expect(segment.requiredSkills).toContain('paint');

    const list = await production.listWorkSegments(ctx(), caseId);
    expect(list.map((s) => s.id)).toContain(segmentId);
  });

  it('capacity is a calculation (comfortable when committed < total)', () => {
    const result = production.computeCapacity({
      totalMinutes: 480,
      committedMinutes: 120,
    });
    expect(result.availableMinutes).toBe(360);
    // Accepting a 60-minute case leaves plenty of headroom.
    expect(
      production.classifyFeasibility(
        { totalMinutes: 480, committedMinutes: 120 },
        60,
      ),
    ).toBe('comfortable');

    const overbooked = production.computeCapacity({
      totalMinutes: 120,
      committedMinutes: 240,
    });
    expect(overbooked.availableMinutes).toBe(-120);
    // Already over the day's total → overbooked.
    expect(
      production.classifyFeasibility(
        { totalMinutes: 120, committedMinutes: 240 },
        0,
      ),
    ).toBe('overbooked');
  });

  it('clocking into a segment moves it to in_progress (the guardrail)', async () => {
    const session = await workforce.clockIn(ctx(), {
      employeeId,
      segmentCode: 'paint_preparation',
      workSegmentId: segmentId,
    });
    expect(session.workSegmentId).toBe(segmentId);

    const list = await production.listWorkSegments(ctx(), caseId);
    const segment = list.find((s) => s.id === segmentId)!;
    expect(segment.status).toBe('in_progress');
    expect(segment.actualStartAt).not.toBeNull();

    const started = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'production.segment.started'
    `;
    expect(started.length).toBeGreaterThanOrEqual(1);

    // Batch 3 — auto vehicle-move suggestion event accompanies segment start.
    const moveSuggested = await h.admin`
      SELECT payload FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'production.vehicle.move_suggested'
    `;
    expect(moveSuggested.length).toBeGreaterThanOrEqual(1);
    const startPayload = moveSuggested[0]!['payload'] as Record<
      string,
      unknown
    >;
    expect(startPayload['trigger']).toBe('segment_started');
    expect(startPayload['segmentId']).toBe(segmentId);
  });

  it('completing a segment recomputes actual_minutes from time entries', async () => {
    await workforce.clockOut(ctx(), employeeId);

    await production.completeSegment(ctx(), segmentId);

    const list = await production.listWorkSegments(ctx(), caseId);
    const segment = list.find((s) => s.id === segmentId)!;
    expect(segment.status).toBe('completed');
    expect(segment.remainingMinutesEstimate).toBe(0);
    // actual_minutes summed from the segment's time entries (>= 0).
    expect(segment.actualMinutes).toBeGreaterThanOrEqual(0);

    const completed = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'production.segment.completed'
    `;
    expect(completed.length).toBeGreaterThanOrEqual(1);

    // Batch 3 — completion fires a second vehicle-move suggestion (next stage).
    const moveSuggested = await h.admin`
      SELECT payload FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'production.vehicle.move_suggested'
      ORDER BY occurred_at
    `;
    expect(moveSuggested.length).toBeGreaterThanOrEqual(2);
    const triggers = moveSuggested.map(
      (r) => (r['payload'] as Record<string, unknown>)['trigger'],
    );
    expect(triggers).toContain('segment_started');
    expect(triggers).toContain('segment_completed');
  });

  it('resource assignment surfaces conflicts instead of overwriting', async () => {
    const resource = await h.admin`
      INSERT INTO resources (organization_id, kind, name, created_by, updated_by)
      VALUES (${orgId}, 'person', 'Spray Booth A', ${ownerUserId}, ${ownerUserId})
      RETURNING id
    `;
    const resourceId = resource[0]!['id'] as string;

    const start = new Date('2025-06-01T08:00:00Z');
    const end = new Date('2025-06-01T10:00:00Z');

    const first = await production.assignResource(ctx(), {
      workSegmentId: segmentId,
      resourceId,
      plannedStartAt: start,
      plannedEndAt: end,
    });
    expect(first.resourceId).toBe(resourceId);

    // Overlapping window on the SAME resource → conflict surfaced.
    await expect(
      production.assignResource(ctx(), {
        workSegmentId: segmentId,
        resourceId,
        plannedStartAt: new Date('2025-06-01T09:00:00Z'),
        plannedEndAt: new Date('2025-06-01T11:00:00Z'),
      }),
    ).rejects.toThrow(/RESOURCE_CONFLICT|overlapping/i);

    // With an explicit override, it records the conflict but proceeds.
    const overridden = await production.assignResource(ctx(), {
      workSegmentId: segmentId,
      resourceId,
      plannedStartAt: new Date('2025-06-01T09:00:00Z'),
      plannedEndAt: new Date('2025-06-01T11:00:00Z'),
      allowConflict: true,
    });
    expect(overridden.conflictOverrideByUserId).toBe(ownerUserId);
  });
});
