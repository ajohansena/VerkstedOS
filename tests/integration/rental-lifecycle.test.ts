import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Rental lifecycle integration suite (Sprint 18).
 * Validates: vehicle registration → reservation (with overlap rejection) →
 * agreement creation → signing → return recording, all against real Postgres.
 */
describe('rental lifecycle', () => {
  let h: IsolationHarness;
  let rental: typeof import('@/modules/rental/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    rental = await import('@/modules/rental/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000018b1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner18b@example.no',
      fullName: 'Liv Leiebil',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Leiebil Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Leiebil Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;
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
      correlationId: '00000000-0000-0000-0000-000000001802',
    };
  }

  it('registers a vehicle and creates a reservation', async () => {
    const vehicle = await rental.registerRentalVehicle(ctx(), {
      registrationNumber: 'AB12345',
      make: 'Toyota',
      model: 'Corolla',
      dailyRate: '550.00',
    });
    expect(vehicle.status).toBe('available');

    const reservation = await rental.createReservation(ctx(), {
      rentalVehicleId: vehicle.id,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-03T16:00:00Z'),
    });
    expect(reservation.status).toBe('planned');

    // overlap should be rejected
    await expect(
      rental.createReservation(ctx(), {
        rentalVehicleId: vehicle.id,
        startsAt: new Date('2026-09-02T08:00:00Z'),
        endsAt: new Date('2026-09-04T16:00:00Z'),
      }),
    ).rejects.toThrow(rental.RentalConflictError);
  });

  it('signs an agreement and records a return', async () => {
    const vehicle = await rental.registerRentalVehicle(ctx(), {
      registrationNumber: 'CD98765',
      make: 'VW',
      model: 'Golf',
      dailyRate: '600.00',
    });
    const reservation = await rental.createReservation(ctx(), {
      rentalVehicleId: vehicle.id,
      startsAt: new Date('2026-09-10T08:00:00Z'),
      endsAt: new Date('2026-09-12T16:00:00Z'),
    });
    const agreement = await rental.createAgreement(ctx(), {
      reservationId: reservation.id,
      terms: 'Standard rental terms apply.',
    });
    expect(agreement.status).toBe('draft');

    const signed = await rental.signAgreement(
      ctx(),
      agreement.id,
      'Kjell Kunde',
    );
    expect(signed.status).toBe('signed');
    expect(signed.signedByName).toBe('Kjell Kunde');
    expect(signed.signedAt).not.toBeNull();

    const ret = await rental.recordReturn(ctx(), {
      agreementId: agreement.id,
      returnedAt: new Date('2026-09-12T15:30:00Z'),
      odometerKm: 1234,
      fuelLevelPercent: 80,
    });
    expect(ret.odometerKm).toBe(1234);
    expect(ret.fuelLevelPercent).toBe(80);
  });

  it('rejects empty signer name', async () => {
    const vehicle = await rental.registerRentalVehicle(ctx(), {
      registrationNumber: 'EF11111',
      dailyRate: '500.00',
    });
    const reservation = await rental.createReservation(ctx(), {
      rentalVehicleId: vehicle.id,
      startsAt: new Date('2026-10-01T08:00:00Z'),
      endsAt: new Date('2026-10-01T16:00:00Z'),
    });
    const agreement = await rental.createAgreement(ctx(), {
      reservationId: reservation.id,
    });
    await expect(
      rental.signAgreement(ctx(), agreement.id, '  '),
    ).rejects.toThrow('SIGNER_NAME_REQUIRED');
  });
});
