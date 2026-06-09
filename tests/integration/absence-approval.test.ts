import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Absence approval workflow integration suite (Sprint 18).
 * Validates request → approve / decline / cancel against real Postgres, plus
 * the capacity helper's view of approved windows.
 */
describe('absence approval', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let employeeId: string;
  let vacationTypeId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000018a1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner18@example.no',
      fullName: 'Frank Fravær',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Fravær Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Fravær Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

    await workforce.ensureDefaultAbsenceTypes(ctx());
    const types = await workforce.listAbsenceTypesForOrg(ctx());
    vacationTypeId = types.find((t) => t.code === 'vacation')!.id;

    const e = await h.admin`
      INSERT INTO employees (organization_id, full_name, status)
      VALUES (${orgId}, 'Astrid Ansatt', 'active') RETURNING id
    `;
    employeeId = e[0]!['id'] as string;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId,
      accessibleWorkshopIds: [workshopId],
      correlationId: '00000000-0000-0000-0000-000000001801',
    };
  }

  it('rejects an inverted date range', async () => {
    await expect(
      workforce.requestAbsence(ctx(), {
        employeeId,
        absenceTypeId: vacationTypeId,
        startsAt: new Date('2026-08-10T08:00:00Z'),
        endsAt: new Date('2026-08-10T07:00:00Z'),
      }),
    ).rejects.toThrow('ABSENCE_RANGE_INVALID');
  });

  it('request → approve flow makes the absence visible to capacity', async () => {
    const start = new Date('2026-08-12T08:00:00Z');
    const end = new Date('2026-08-12T16:00:00Z');
    const req = await workforce.requestAbsence(ctx(), {
      employeeId,
      absenceTypeId: vacationTypeId,
      startsAt: start,
      endsAt: end,
    });
    expect(req.status).toBe('requested');
    const pending = await workforce.listPendingAbsenceRequests(ctx());
    expect(pending.some((p) => p.entry.id === req.id)).toBe(true);

    const approved = await workforce.approveAbsence(ctx(), req.id);
    expect(approved.status).toBe('approved');

    const windows = await workforce.listApprovedAbsenceWindowsForEmployees(
      ctx(),
      [employeeId],
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
    );
    expect(windows.some((w) => w.employeeId === employeeId)).toBe(true);
  });

  it('decline requires a reason', async () => {
    const req = await workforce.requestAbsence(ctx(), {
      employeeId,
      absenceTypeId: vacationTypeId,
      startsAt: new Date('2026-08-15T08:00:00Z'),
      endsAt: new Date('2026-08-15T16:00:00Z'),
    });
    await expect(
      workforce.declineAbsence(ctx(), req.id, ''),
    ).rejects.toThrow('ABSENCE_DECLINE_REASON_REQUIRED');
    const declined = await workforce.declineAbsence(
      ctx(),
      req.id,
      'No coverage available.',
    );
    expect(declined.status).toBe('declined');
    expect(declined.declinedReason).toBe('No coverage available.');
  });

  it('cancel sets status to cancelled', async () => {
    const req = await workforce.requestAbsence(ctx(), {
      employeeId,
      absenceTypeId: vacationTypeId,
      startsAt: new Date('2026-08-20T08:00:00Z'),
      endsAt: new Date('2026-08-20T16:00:00Z'),
    });
    const cancelled = await workforce.cancelAbsence(ctx(), req.id);
    expect(cancelled.status).toBe('cancelled');
  });
});
