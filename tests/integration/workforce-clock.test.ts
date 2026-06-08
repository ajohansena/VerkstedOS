import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Workforce clock + time integration suite (Sprint 9).
 *
 * Validates against real Postgres: employee creation with skills (combined
 * roles), clock-in/out producing an event-tier time entry, the ONE-open-session
 * partial unique guard, the "who's working" view, and full-audited corrections.
 */
describe('workforce clock + time', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let employeeId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000a9';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner9@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Workforce Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
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
      correlationId: '00000000-0000-0000-0000-0000000000fc',
    };
  }

  it('creates a combined-role employee (body + paint + reassembly)', async () => {
    const employee = await workforce.createEmployee(ctx(), {
      fullName: 'Erik Tekniker',
      skills: [
        { skillCode: 'body', proficiency: 'expert' },
        { skillCode: 'paint', proficiency: 'qualified' },
        { skillCode: 'assembly', proficiency: 'qualified' },
      ],
    });
    employeeId = employee.id;

    const skills = await workforce.listSkills(ctx(), employeeId);
    expect(skills.map((s) => s.skillCode).sort()).toEqual([
      'assembly',
      'body',
      'paint',
    ]);
  });

  it('clocks in to a paint segment', async () => {
    const session = await workforce.clockIn(ctx(), {
      employeeId,
      segmentCode: 'paint_preparation',
    });
    expect(session.status).toBe('open');
    expect(session.segmentCode).toBe('paint_preparation');

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId} AND event_type = 'workforce.clock.in'
    `;
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('the manager sees who is working', async () => {
    const working = await workforce.listWorkingNow(ctx());
    expect(working.some((w) => w.employeeId === employeeId)).toBe(true);
    expect(working.find((w) => w.employeeId === employeeId)!.segmentCode).toBe(
      'paint_preparation',
    );
  });

  it('rejects a second clock-in while already clocked in', async () => {
    await expect(
      workforce.clockIn(ctx(), { employeeId, segmentCode: 'body_repair' }),
    ).rejects.toThrow(/ALREADY_CLOCKED_IN/);
  });

  it('clocks out and produces an event-tier time entry', async () => {
    const { durationMinutes } = await workforce.clockOut(ctx(), employeeId);
    expect(durationMinutes).toBeGreaterThanOrEqual(0);

    const entries = await workforce.listTimeEntries(ctx(), employeeId);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]!.kind).toBe('work');
    expect(entries[0]!.segmentCode).toBe('paint_preparation');

    // Now clockable in again (no open session).
    const open = await workforce.findOpenSession(ctx(), employeeId);
    expect(open).toBeNull();
  });

  it('rejects clock-out when not clocked in', async () => {
    await expect(workforce.clockOut(ctx(), employeeId)).rejects.toThrow(
      /NOT_CLOCKED_IN/,
    );
  });

  it('one-open-session partial unique holds at the DB level', async () => {
    // Insert an open session directly, then a second open insert must fail.
    await h.admin`
      INSERT INTO clock_sessions (organization_id, employee_id, status)
      VALUES (${orgId}, ${employeeId}, 'open')
    `;
    await expect(
      h.admin`
        INSERT INTO clock_sessions (organization_id, employee_id, status)
        VALUES (${orgId}, ${employeeId}, 'open')
      `,
    ).rejects.toThrow();
  });

  it('records a full-audited time correction as a new row', async () => {
    const entries = await workforce.listTimeEntries(ctx(), employeeId);
    const original = entries.find((e) => e.kind === 'work')!;

    await workforce.correctTimeEntry(ctx(), {
      originalEntryId: original.id,
      employeeId,
      durationMinutes: 90,
      reason: 'Forgot to clock out',
    });

    const after = await workforce.listTimeEntries(ctx(), employeeId);
    const correction = after.find((e) => e.kind === 'correction')!;
    expect(correction.correctsEntryId).toBe(original.id);
    expect(correction.durationMinutes).toBe(90);

    const audit = await h.admin`
      SELECT reason FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'time_entries'
    `;
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });
});
