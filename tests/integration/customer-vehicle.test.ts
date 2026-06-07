import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Customer & Vehicle integration suite (Sprint 5).
 *
 * Validates against real Postgres (migrations incl. lookup tables + RLS):
 * customer CRUD with checksum validation + audit/outbox, vehicle CRUD with
 * ownership-history tracking, search, and the lookup-cache adapters.
 */
describe('customer & vehicle', () => {
  let h: IsolationHarness;
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000d1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner5@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Customer Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctx = () => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId: null,
    accessibleWorkshopIds: [] as string[],
    correlationId: '00000000-0000-0000-0000-0000000000df',
  });

  it('creates an individual customer and audits it', async () => {
    const created = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Ola Hansen',
      identifier: '01010150074',
      identifierKind: 'personal_id_no',
      primaryPhone: '99887766',
    });
    expect(created.name).toBe('Ola Hansen');

    const audit = await h.admin`
      SELECT action FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'customers'
        AND entity_id = ${created.id}
    `;
    expect(audit.length).toBeGreaterThanOrEqual(1);

    const outbox = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'customer.customer.created'
    `;
    expect(outbox.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects an invalid personnummer checksum', async () => {
    await expect(
      customer.createCustomer(ctx(), {
        kind: 'individual',
        name: 'Bad Checksum',
        identifier: '01010150075', // tampered control digit
        identifierKind: 'personal_id_no',
      }),
    ).rejects.toThrow(/INVALID_IDENTIFIER/);
  });

  it('rejects an invalid orgnummer checksum', async () => {
    await expect(
      customer.createCustomer(ctx(), {
        kind: 'company',
        name: 'Bad Org AS',
        identifier: '914782008', // wrong control digit
        identifierKind: 'org_no_no',
      }),
    ).rejects.toThrow(/INVALID_IDENTIFIER/);
  });

  it('finds customers by search', async () => {
    const results = await customer.searchCustomers(ctx(), 'Ola');
    expect(results.some((c) => c.name === 'Ola Hansen')).toBe(true);
  });

  it('creates a leasing vehicle with separate owner and user, recording ownership', async () => {
    const lessor = await customer.createCustomer(ctx(), {
      kind: 'leasing_company',
      name: 'DNB Leasing AS',
      identifier: '981290666',
      identifierKind: 'org_no_no',
    });
    const driver = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Kari Driver',
    });

    const vehicle = await customer.createVehicle(ctx(), {
      registrationNumber: 'AB12345',
      vin: 'WAUZZZ8K9AA000000',
      make: 'Audi',
      model: 'A4',
      year: 2021,
      ownerCustomerId: lessor.id,
      userCustomerId: driver.id,
      ownershipType: 'leased',
    });
    expect(vehicle.ownershipType).toBe('leased');

    const history = await customer.listOwnershipHistory(ctx(), vehicle.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.ownerCustomerId).toBe(lessor.id);
    expect(history[0]!.userCustomerId).toBe(driver.id);
  });

  it('appends ownership history when the owner changes', async () => {
    const v = await customer.createVehicle(ctx(), {
      registrationNumber: 'CD54321',
      ownershipType: 'private',
    });
    const newOwner = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'New Owner',
    });

    await customer.updateVehicle(ctx(), v.id, {
      ownerCustomerId: newOwner.id,
      ownershipType: 'private',
    });

    const history = await customer.listOwnershipHistory(ctx(), v.id);
    // One row from creation + one from the owner change.
    expect(history.length).toBe(2);
  });

  it('finds vehicles by registration number', async () => {
    const results = await customer.searchVehicles(ctx(), 'AB12345');
    expect(results.some((v) => v.registrationNumber === 'AB12345')).toBe(true);
  });

  it('vegvesen lookup returns not_configured without an API key', async () => {
    const result = await customer.lookupVehicleByReg(ctx(), 'AB12345');
    expect(result.source).toBe('not_configured');
    expect(result.found).toBe(false);
  });

  it('1881 lookup returns not_configured without an API key', async () => {
    const result = await customer.lookupByPhone(ctx(), '99887766');
    expect(result.source).toBe('not_configured');
  });
});
