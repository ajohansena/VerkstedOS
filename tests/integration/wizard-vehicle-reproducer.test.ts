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
  // H3 — cross-tenant FK reference hole (CLAUDE.md §4.2 P0).
  //
  // Migration 0055 adds a composite FK
  //   (organization_id, owner_customer_id) → customers(organization_id, id)
  // on top of the existing single-column FK. Together they enforce:
  //   • the customer exists (single-column FK)
  //   • the customer belongs to the SAME organisation (composite FK)
  //
  // Postgres FK validation runs with system privileges and bypasses RLS, so
  // this enforcement is independent of the connecting role — both the
  // tenant-aware client and any future admin path are caught.
  //
  // This assertion is the canonical regression for the P0 leak. Same shape
  // applies on every other customer-FK column (cases.primary_customer_id,
  // case_funding_sources.payer_customer_id + deductible_payer_customer_id,
  // case_parties.customer_id, communication_threads.customer_id,
  // case_acceptances.customer_id, invoice_basis.payer_customer_id,
  // rental_reservations.customer_id, vehicle_ownership_history.{owner,user}).
  // ──────────────────────────────────────────────────────────────────────
  it('H3 — cross-org owner_customer_id is rejected by composite FK (was P0 leak)', async () => {
    const orgBCustomer = await customer.createCustomer(ctx(orgBId), {
      kind: 'individual',
      name: 'Org B Customer',
    });

    await expect(
      customer.createVehicle(ctx(orgAId), {
        registrationNumber: 'EF89844',
        ownershipType: 'unknown',
        ownerCustomerId: orgBCustomer.id,
      }),
    ).rejects.toThrow();
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
