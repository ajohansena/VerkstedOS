import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Case bookings integration suite (D2).
 *
 * Validates against real Postgres:
 *   • create → confirm → arrived lifecycle (incl. event payloads).
 *   • cancel + re-book (the partial-unique-index allows a new active row once
 *     the previous one is cancelled).
 *   • date validation rejects delivery-before-arrival.
 *   • listBookingsForWorkshopInRange returns only active bookings in window.
 *   • Cross-org isolation: a context in org B cannot see org A's bookings.
 */
describe('case bookings (D2)', () => {
  let h: IsolationHarness;
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgAId: string;
  let orgBId: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let workshopAId: string;
  let workshopBId: string;
  let payerAId: string;
  let payerBId: string;
  let caseAId: string;
  let caseBId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerAUserId = '00000000-0000-0000-0000-0000000d2a01';
    ownerBUserId = '00000000-0000-0000-0000-0000000d2b01';
    await identity.ensureUser({
      id: ownerAUserId,
      email: 'd2-owner-a@example.no',
      fullName: 'Owner A',
    });
    await identity.ensureUser({
      id: ownerBUserId,
      email: 'd2-owner-b@example.no',
      fullName: 'Owner B',
    });
    const a = await identity.createOrganizationWithOwner({
      name: 'D2 Workshop A',
      ownerUserId: ownerAUserId,
    });
    const b = await identity.createOrganizationWithOwner({
      name: 'D2 Workshop B',
      ownerUserId: ownerBUserId,
    });
    orgAId = a.organization.id;
    orgBId = b.organization.id;

    const [wsA] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgAId}, 'Bergen') RETURNING id
    `;
    workshopAId = wsA!['id'] as string;
    const [wsB] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgBId}, 'Stavanger') RETURNING id
    `;
    workshopBId = wsB!['id'] as string;

    const cA = await customer.createCustomer(ctxA(), {
      kind: 'individual',
      name: 'Customer A',
    });
    payerAId = cA.id;
    const cB = await customer.createCustomer(ctxB(), {
      kind: 'individual',
      name: 'Customer B',
    });
    payerBId = cB.id;

    const caseA = await caseModule.createCase(ctxA(), {
      primaryCustomerId: payerAId,
      fundingSources: [],
    });
    caseAId = caseA.id;
    const caseB = await caseModule.createCase(ctxB(), {
      primaryCustomerId: payerBId,
      fundingSources: [],
    });
    caseBId = caseB.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctxA = () => ({
    userId: ownerAUserId,
    organizationId: orgAId,
    workshopId: workshopAId,
    accessibleWorkshopIds: [workshopAId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d2a99',
  });
  const ctxB = () => ({
    userId: ownerBUserId,
    organizationId: orgBId,
    workshopId: workshopBId,
    accessibleWorkshopIds: [workshopBId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d2b99',
  });

  it('lifecycle: create (tentative) → confirm → mark arrived', async () => {
    const arrival = new Date(Date.now() + 24 * 3600_000);
    const delivery = new Date(arrival.getTime() + 8 * 3600_000);
    const created = await caseModule.createBooking(ctxA(), {
      caseId: caseAId,
      workshopId: workshopAId,
      expectedArrivalAt: arrival,
      promisedDeliveryAt: delivery,
      notes: 'left front bumper',
    });
    expect(created.status).toBe('tentative');

    await caseModule.confirmBooking(ctxA(), created.id);
    const afterConfirm = await caseModule.findActiveBookingForCase(
      ctxA(),
      caseAId,
    );
    expect(afterConfirm?.status).toBe('confirmed');
    expect(afterConfirm?.confirmedAt).not.toBeNull();

    await caseModule.markArrived(ctxA(), created.id);
    const afterArrival = await caseModule.findActiveBookingForCase(
      ctxA(),
      caseAId,
    );
    expect(afterArrival?.status).toBe('arrived');
    expect(afterArrival?.arrivedAt).not.toBeNull();

    const events = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgAId}
        AND event_type IN ('case.booking.created','case.booking.arrived')
      ORDER BY occurred_at
    `;
    const topics = events.map((e) => e['event_type'] as string);
    expect(topics).toContain('case.booking.created');
    expect(topics).toContain('case.booking.arrived');
  });

  it('cancel + re-book replaces the active booking', async () => {
    const fresh = await caseModule.createCase(ctxA(), {
      primaryCustomerId: payerAId,
      fundingSources: [],
    });
    const arrival1 = new Date(Date.now() + 48 * 3600_000);
    const first = await caseModule.createBooking(ctxA(), {
      caseId: fresh.id,
      workshopId: workshopAId,
      expectedArrivalAt: arrival1,
      promisedDeliveryAt: new Date(arrival1.getTime() + 6 * 3600_000),
    });

    // While first is still active, trying to create a second should fail.
    await expect(
      caseModule.createBooking(ctxA(), {
        caseId: fresh.id,
        workshopId: workshopAId,
        expectedArrivalAt: arrival1,
        promisedDeliveryAt: null,
      }),
    ).rejects.toBeInstanceOf(caseModule.BookingValidationError);

    await caseModule.cancelBooking(ctxA(), first.id, 'customer reschedule');

    const arrival2 = new Date(Date.now() + 72 * 3600_000);
    const second = await caseModule.createBooking(ctxA(), {
      caseId: fresh.id,
      workshopId: workshopAId,
      expectedArrivalAt: arrival2,
      promisedDeliveryAt: new Date(arrival2.getTime() + 4 * 3600_000),
    });
    expect(second.status).toBe('tentative');

    const history = await caseModule.listBookingsForCase(ctxA(), fresh.id);
    expect(history).toHaveLength(2);
    expect(history[0]!.id).toBe(second.id); // newest first
    expect(history[1]!.id).toBe(first.id);
    expect(history[1]!.status).toBe('cancelled');
  });

  it('rejects delivery-before-arrival', async () => {
    const fresh = await caseModule.createCase(ctxA(), {
      primaryCustomerId: payerAId,
      fundingSources: [],
    });
    const arrival = new Date(Date.now() + 36 * 3600_000);
    const delivery = new Date(arrival.getTime() - 3600_000); // 1h BEFORE
    await expect(
      caseModule.createBooking(ctxA(), {
        caseId: fresh.id,
        workshopId: workshopAId,
        expectedArrivalAt: arrival,
        promisedDeliveryAt: delivery,
      }),
    ).rejects.toBeInstanceOf(caseModule.BookingValidationError);
  });

  it('listBookingsForWorkshopInRange returns only active bookings overlapping window', async () => {
    const fresh = await caseModule.createCase(ctxA(), {
      primaryCustomerId: payerAId,
      fundingSources: [],
    });
    const windowStart = new Date(Date.now() + 5 * 24 * 3600_000);
    const windowEnd = new Date(windowStart.getTime() + 24 * 3600_000);
    const arrival = new Date(windowStart.getTime() + 2 * 3600_000);
    await caseModule.createBooking(ctxA(), {
      caseId: fresh.id,
      workshopId: workshopAId,
      expectedArrivalAt: arrival,
      promisedDeliveryAt: new Date(arrival.getTime() + 3 * 3600_000),
      confirmImmediately: true,
    });
    const rows = await caseModule.listBookingsForWorkshopInRange(
      ctxA(),
      workshopAId,
      { from: windowStart, to: windowEnd },
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.caseId === fresh.id)).toBe(true);
    // None should be cancelled in the active list.
    expect(rows.every((r) => r.status !== 'cancelled')).toBe(true);
  });

  it('cross-org isolation: org B cannot read org A bookings', async () => {
    // Org A has bookings on caseAId from earlier tests.
    const inA = await caseModule.listBookingsForCase(ctxA(), caseAId);
    expect(inA.length).toBeGreaterThanOrEqual(1);

    // Trying to read org A's case as org B must return empty (or throw — both acceptable).
    let inBForA: Awaited<ReturnType<typeof caseModule.listBookingsForCase>> = [];
    try {
      inBForA = await caseModule.listBookingsForCase(ctxB(), caseAId);
    } catch {
      inBForA = [];
    }
    expect(inBForA.length).toBe(0);

    // Org B can read its OWN case bookings (creating one first).
    const bBooking = await caseModule.createBooking(ctxB(), {
      caseId: caseBId,
      workshopId: workshopBId,
      expectedArrivalAt: new Date(Date.now() + 96 * 3600_000),
      promisedDeliveryAt: null,
    });
    const inBForB = await caseModule.listBookingsForCase(ctxB(), caseBId);
    expect(inBForB.map((r) => r.id)).toContain(bBooking.id);
  });
});
