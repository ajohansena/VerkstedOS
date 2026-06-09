import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Yard management integration suite (Sprint 19).
 *
 * Validates: layout + location creation → vehicle moved to a location →
 * second move appends a new movement row and updates status on both source
 * and destination → capacity-full slot rejects → QR-tag resolution → unknown
 * QR throws. All against real Postgres with RLS.
 */
describe('yard management', () => {
  let h: IsolationHarness;
  let yard: typeof import('@/modules/yard/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseAId: string;
  let caseBId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    yard = await import('@/modules/yard/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000019b1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner19@example.no',
      fullName: 'Yvonne Yard',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Tomt Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Yard Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseAId = created.id;
    const second = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseBId = second.id;
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
      correlationId: '00000000-0000-0000-0000-0000000019f9',
    };
  }

  let layoutId: string;
  let bayId: string;
  let storageId: string;
  let qrLocationId: string;

  it('creates a layout with three locations', async () => {
    const layout = await yard.createYardLayout(ctx(), {
      workshopId,
      code: 'Y1',
      name: 'Hovedtomt',
    });
    layoutId = layout.id;

    const bay = await yard.createYardLocation(ctx(), {
      layoutId,
      code: 'B1',
      kind: 'bay',
      capacity: 1,
    });
    bayId = bay.id;

    const storage = await yard.createYardLocation(ctx(), {
      layoutId,
      code: 'S1',
      kind: 'storage',
      capacity: 2,
    });
    storageId = storage.id;

    const qrLoc = await yard.createYardLocation(ctx(), {
      layoutId,
      code: 'P1',
      kind: 'parking',
      capacity: 1,
      qrTag: 'QR-P1-19',
    });
    qrLocationId = qrLoc.id;

    const list = await yard.listLocationsForLayout(ctx(), layoutId);
    expect(list).toHaveLength(3);
    expect(list.every((l) => l.status === 'available')).toBe(true);
  });

  it('moves a vehicle into the bay and marks it occupied', async () => {
    const result = await yard.moveVehicleToLocation(ctx(), {
      caseId: caseAId,
      toLocationId: bayId,
      reason: 'into_bay',
    });
    expect(result.placement.locationId).toBe(bayId);
    expect(result.previousLocationId).toBeNull();
    expect(result.movement.reason).toBe('into_bay');

    const bay = await yard.findYardLocationById(ctx(), bayId);
    expect(bay?.status).toBe('occupied');

    const movements = await yard.listVehicleMovementsForCase(ctx(), caseAId);
    expect(movements).toHaveLength(1);
  });

  it('moving the same case to a new slot appends a second movement and frees the old slot', async () => {
    const result = await yard.moveVehicleToLocation(ctx(), {
      caseId: caseAId,
      toLocationId: storageId,
      reason: 'into_storage',
    });
    expect(result.previousLocationId).toBe(bayId);
    expect(result.placement.locationId).toBe(storageId);

    const bay = await yard.findYardLocationById(ctx(), bayId);
    expect(bay?.status).toBe('available');

    const storage = await yard.findYardLocationById(ctx(), storageId);
    // capacity=2, occupied=1 → still available
    expect(storage?.status).toBe('available');

    const movements = await yard.listVehicleMovementsForCase(ctx(), caseAId);
    expect(movements).toHaveLength(2);
    expect(movements[0]!.toLocationId).toBe(storageId);
    expect(movements[1]!.toLocationId).toBe(bayId);
  });

  it('rejects a move into a full single-capacity slot', async () => {
    // Move caseB into the bay (capacity 1, currently free)
    await yard.moveVehicleToLocation(ctx(), {
      caseId: caseBId,
      toLocationId: bayId,
      reason: 'into_bay',
    });
    const bay = await yard.findYardLocationById(ctx(), bayId);
    expect(bay?.status).toBe('occupied');

    // A second case cannot occupy the same single-cap bay
    const caseC = await caseModule.createCase(ctx(), { fundingSources: [] });
    await expect(
      yard.moveVehicleToLocation(ctx(), {
        caseId: caseC.id,
        toLocationId: bayId,
        reason: 'into_bay',
      }),
    ).rejects.toBeInstanceOf(yard.YardLocationFullError);
  });

  it('rejects a move into a blocked slot', async () => {
    // Mark the storage as blocked via a fresh location to keep state clean.
    const blocked = await yard.createYardLocation(ctx(), {
      layoutId,
      code: 'X1',
      kind: 'temporary',
      capacity: 1,
    });
    await h.admin`
      UPDATE yard_locations SET status = 'blocked' WHERE id = ${blocked.id}
    `;
    const caseD = await caseModule.createCase(ctx(), { fundingSources: [] });
    await expect(
      yard.moveVehicleToLocation(ctx(), {
        caseId: caseD.id,
        toLocationId: blocked.id,
      }),
    ).rejects.toBeInstanceOf(yard.YardLocationBlockedError);
  });

  it('resolves a QR tag and moves the vehicle there', async () => {
    const caseE = await caseModule.createCase(ctx(), { fundingSources: [] });
    const result = await yard.moveVehicleByQrTag(
      ctx(),
      caseE.id,
      'QR-P1-19',
    );
    expect(result.placement.locationId).toBe(qrLocationId);

    const loc = await yard.findYardLocationById(ctx(), qrLocationId);
    expect(loc?.status).toBe('occupied');
  });

  it('throws YARD_QR_NOT_FOUND for an unknown QR tag', async () => {
    const caseF = await caseModule.createCase(ctx(), { fundingSources: [] });
    await expect(
      yard.moveVehicleByQrTag(ctx(), caseF.id, 'QR-DOES-NOT-EXIST'),
    ).rejects.toThrow('YARD_QR_NOT_FOUND');
  });
});
