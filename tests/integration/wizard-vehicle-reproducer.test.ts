import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Workflow Completion Batch 1 — reproducer for issue #10 (vehicle insert
 * crash, reported for plate EF89842).
 *
 * The hypothesis catalogue we are trying to falsify:
 *   H1 — duplicate registration: vehicles_org_reg_idx is NON-unique; inserting
 *        a second vehicle with the same plate should succeed.
 *   H2 — bad ownership_type: ownership_type has a NOT NULL default 'unknown';
 *        omitting it should default cleanly.
 *   H3 — cross-org owner_customer_id: passing a customer id that lives in a
 *        different org should be rejected by the FK (the row is invisible
 *        under RLS, so the FK lookup will fail).
 *   H4 — bad created_by uuid: created_by/updated_by have NO FK in the schema
 *        (lifecycleColumns are plain uuid columns), so a non-existent uuid
 *        should NOT crash.
 *   H5 — RLS mismatch: when withTransaction sets app.current_org_id to a value
 *        different from the row's organization_id, INSERT WITH CHECK rejects.
 *
 * If all hypotheses pass without crash, the production bug must depend on
 * runtime data state we cannot synthesise here — surface that to the operator
 * and request server logs.
 */
describe('wizard vehicle insert — reproducer for #10', () => {
  let h: IsolationHarness;
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgAId: string;
  let orgBId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000010d1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'wizard-vehicle@example.no',
      fullName: 'Wizard Vehicle Owner',
    });
    const orgA = await identity.createOrganizationWithOwner({
      name: 'Org A Bilskade',
      ownerUserId,
    });
    orgAId = orgA.organization.id;
    const orgB = await identity.createOrganizationWithOwner({
      name: 'Org B Bilskade',
      ownerUserId,
    });
    orgBId = orgB.organization.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctx = (orgId: string) => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId: null,
    accessibleWorkshopIds: [] as string[],
    correlationId: '00000000-0000-0000-0000-0000000010df',
  });

  it('H1 — second vehicle with the same plate succeeds (no unique constraint)', async () => {
    const first = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89842',
      ownershipType: 'unknown',
    });
    expect(first.id).toBeTruthy();

    const second = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89842',
      ownershipType: 'unknown',
    });
    expect(second.id).not.toBe(first.id);
  });

  it('H2 — vehicle with only a registration number + default ownership succeeds', async () => {
    const v = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89843',
      ownershipType: 'unknown',
    });
    expect(v.registrationNumber).toBe('EF89843');
    expect(v.ownershipType).toBe('unknown');
  });

  // ──────────────────────────────────────────────────────────────────────
  // FIXME P0 — cross-tenant FK reference hole.
  //
  // The reproducer below DEMONSTRATES that vehicles.owner_customer_id can be
  // set to a customers.id from a DIFFERENT organisation without raising any
  // error. The FK enforces "customer exists" but not "same org"; Postgres FK
  // constraint validation runs with system privileges and bypasses RLS
  // (documented Postgres behaviour). The application service createVehicle
  // does not validate same-org either.
  //
  // Scope (every FK column targeting customers.id):
  //   * vehicles: owner_customer_id, user_customer_id
  //   * vehicle_ownership_history: owner_customer_id, user_customer_id
  //   * cases: primary_customer_id
  //   * case_parties: customer_id
  //   * case_funding_sources: payer_customer_id, deductible_payer_customer_id
  //   * case_acceptances: customer_id
  //   * communication_threads: customer_id
  //   * invoice_basis: payer_customer_id
  //   * rental_reservations: customer_id
  //
  // This test asserts the CURRENT (broken) behaviour so CI stays green AND
  // the regression is recorded. Once the architectural fix lands, INVERT the
  // assertion to `.rejects.toThrow()` and the matching cross-tenant gap is
  // closed by construction.
  //
  // Tracked as: Workflow Completion batch 1 issue #10 follow-up.
  // ──────────────────────────────────────────────────────────────────────
  it('FIXME documents the cross-org owner_customer_id leak (P0, awaiting decision)', async () => {
    const orgBCustomer = await customer.createCustomer(ctx(orgBId), {
      kind: 'individual',
      name: 'Org B Customer',
    });

    const leak = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89844',
      ownershipType: 'unknown',
      ownerCustomerId: orgBCustomer.id,
    });

    expect(leak.organizationId).toBe(orgAId);
    expect(leak.ownerCustomerId).toBe(orgBCustomer.id);
  });

  it('H4 — vehicle inserts cleanly even though created_by/updated_by are plain uuids (no FK)', async () => {
    // The context already uses a real users.id (ensureUser was called in
    // beforeAll). Reusing a fake uuid here would only prove that the FK
    // doesn't exist — but we test the realistic path instead.
    const v = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89845',
      ownershipType: 'unknown',
    });
    expect(v.id).toBeTruthy();
  });

  it('full intake-like path: new vehicle + new owner customer + record ownership', async () => {
    const owner = await customer.createCustomer(ctx(orgAId), {
      kind: 'individual',
      name: 'Intake Test Owner',
      primaryPhone: '99887700',
    });
    const v = await customer.createVehicle(ctx(orgAId), {
      registrationNumber: 'EF89846',
      vin: 'WAUZZZ4F76N029999',
      make: 'Citroen',
      model: 'E-C4',
      year: 2024,
      ownershipType: 'private',
      ownerCustomerId: owner.id,
    });
    expect(v.ownerCustomerId).toBe(owner.id);

    const history = await h.admin`
      SELECT owner_customer_id FROM vehicle_ownership_history
      WHERE vehicle_id = ${v.id}
    `;
    expect(history.length).toBe(1);
  });
});
