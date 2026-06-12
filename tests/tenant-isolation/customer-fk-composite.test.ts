import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startIsolationHarness, type IsolationHarness } from './harness';

/**
 * Tenant-isolation gate for the customer-FK composite constraints
 * (CLAUDE.md § 4.2 P0 — migration 0055).
 *
 * Background: Postgres FK validation runs with system privileges and bypasses
 * Row-Level Security. A bare single-column FK like
 * `vehicles.owner_customer_id → customers.id` enforces "customer exists" but
 * does NOT enforce "customer belongs to the same organisation as the row" —
 * the FK check sees customers from every org. Migration 0055 closes this hole
 * by adding a composite FK on (organization_id, customer_id) → customers
 * (organization_id, id) for every table that references customers.
 *
 * This suite proves the composite FKs reject cross-org references on every
 * affected column. The check is done via raw admin SQL so it does not depend
 * on any service-layer defence (which, by §4.2, must not be the only line of
 * protection). If a future migration removes a composite FK by accident, the
 * matching test below will fail loud.
 *
 * Coverage (every customer-FK column that existed at migration time):
 *   - vehicles.owner_customer_id
 *   - vehicles.user_customer_id
 *   - vehicle_ownership_history.owner_customer_id
 *   - vehicle_ownership_history.user_customer_id
 *   - cases.primary_customer_id
 *   - case_parties.customer_id
 *   - case_funding_sources.payer_customer_id
 *   - case_funding_sources.deductible_payer_customer_id
 *   - case_acceptances.customer_id
 *   - communication_threads.customer_id
 *   - invoice_basis.payer_customer_id
 *   - rental_reservations.customer_id
 */
describe('customer-FK composite constraint (cross-org leak P0)', () => {
  let h: IsolationHarness;
  let orgA: string;
  let orgB: string;
  let customerA: string;
  let customerB: string;
  let caseA: string;
  let vehicleA: string;
  let fundingSourceA: string;
  let rentalVehicleA: string;
  let threadA: string;

  beforeAll(async () => {
    h = await startIsolationHarness();

    // Two orgs. All subsequent setup runs as the superuser so RLS does not
    // confuse the FK behaviour we're trying to test.
    const [a] = await h.admin`
      INSERT INTO organizations (name) VALUES ('FK Org A') RETURNING id
    `;
    const [b] = await h.admin`
      INSERT INTO organizations (name) VALUES ('FK Org B') RETURNING id
    `;
    orgA = a!['id'] as string;
    orgB = b!['id'] as string;

    // One customer per org.
    const [ca] = await h.admin`
      INSERT INTO customers (organization_id, kind, name)
      VALUES (${orgA}, 'individual', 'A Customer') RETURNING id
    `;
    const [cb] = await h.admin`
      INSERT INTO customers (organization_id, kind, name)
      VALUES (${orgB}, 'individual', 'B Customer') RETURNING id
    `;
    customerA = ca!['id'] as string;
    customerB = cb!['id'] as string;

    // A case + vehicle in org A so we can probe child tables.
    const [v] = await h.admin`
      INSERT INTO vehicles (organization_id, registration_number, ownership_type)
      VALUES (${orgA}, 'FKTEST1', 'unknown') RETURNING id
    `;
    vehicleA = v!['id'] as string;

    const [c] = await h.admin`
      INSERT INTO cases (organization_id, case_number, vehicle_id, primary_customer_id)
      VALUES (${orgA}, 'FK-CASE-1', ${vehicleA}, ${customerA}) RETURNING id
    `;
    caseA = c!['id'] as string;

    const [fs] = await h.admin`
      INSERT INTO case_funding_sources (
        organization_id, case_id, sequence_no, kind, label, payer_customer_id
      ) VALUES (
        ${orgA}, ${caseA}, 1, 'private_pay', 'Private', ${customerA}
      ) RETURNING id
    `;
    fundingSourceA = fs!['id'] as string;

    // A rental vehicle + thread we can attach to.
    const [rv] = await h.admin`
      INSERT INTO rental_vehicles (organization_id, registration_number, status)
      VALUES (${orgA}, 'RV-FK-A1', 'available') RETURNING id
    `;
    rentalVehicleA = rv!['id'] as string;

    const [t] = await h.admin`
      INSERT INTO communication_threads (
        organization_id, case_id, channel, contact_value
      ) VALUES (
        ${orgA}, ${caseA}, 'sms', '+4791000001'
      ) RETURNING id
    `;
    threadA = t!['id'] as string;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  it('vehicles.owner_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO vehicles (organization_id, registration_number, ownership_type, owner_customer_id)
      VALUES (${orgA}, 'FKVO1', 'unknown', ${customerB})
    `).rejects.toThrow(/vehicles_owner_customer_same_org_fk/);
  });

  it('vehicles.user_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO vehicles (organization_id, registration_number, ownership_type, user_customer_id)
      VALUES (${orgA}, 'FKVU1', 'unknown', ${customerB})
    `).rejects.toThrow(/vehicles_user_customer_same_org_fk/);
  });

  it('vehicle_ownership_history.owner_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO vehicle_ownership_history (
        organization_id, vehicle_id, owner_customer_id, ownership_type
      ) VALUES (
        ${orgA}, ${vehicleA}, ${customerB}, 'unknown'
      )
    `).rejects.toThrow(/voh_owner_customer_same_org_fk/);
  });

  it('vehicle_ownership_history.user_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO vehicle_ownership_history (
        organization_id, vehicle_id, user_customer_id, ownership_type
      ) VALUES (
        ${orgA}, ${vehicleA}, ${customerB}, 'unknown'
      )
    `).rejects.toThrow(/voh_user_customer_same_org_fk/);
  });

  it('cases.primary_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO cases (organization_id, case_number, primary_customer_id)
      VALUES (${orgA}, 'FK-CASE-2', ${customerB})
    `).rejects.toThrow(/cases_primary_customer_same_org_fk/);
  });

  it('case_parties.customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO case_parties (organization_id, case_id, role, customer_id)
      VALUES (${orgA}, ${caseA}, 'counterparty', ${customerB})
    `).rejects.toThrow(/case_parties_customer_same_org_fk/);
  });

  it('case_funding_sources.payer_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO case_funding_sources (
        organization_id, case_id, sequence_no, kind, label, payer_customer_id
      ) VALUES (
        ${orgA}, ${caseA}, 2, 'private_pay', 'Bad', ${customerB}
      )
    `).rejects.toThrow(/cfs_payer_customer_same_org_fk/);
  });

  it('case_funding_sources.deductible_payer_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO case_funding_sources (
        organization_id, case_id, sequence_no, kind, label, deductible_payer_customer_id
      ) VALUES (
        ${orgA}, ${caseA}, 3, 'insurance', 'Bad', ${customerB}
      )
    `).rejects.toThrow(/cfs_deductible_payer_customer_same_org_fk/);
  });

  it('case_acceptances.customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO case_acceptances (
        organization_id, case_id, customer_id, token
      ) VALUES (
        ${orgA}, ${caseA}, ${customerB}, 'fk-token-x1'
      )
    `).rejects.toThrow(/case_acceptances_customer_same_org_fk/);
  });

  it('communication_threads.customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO communication_threads (
        organization_id, case_id, customer_id, channel, contact_value
      ) VALUES (
        ${orgA}, ${caseA}, ${customerB}, 'sms', '+4791000099'
      )
    `).rejects.toThrow(/comm_threads_customer_same_org_fk/);
  });

  it('invoice_basis.payer_customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO invoice_basis (
        organization_id, case_id, funding_source_id, basis_number, payer_type, payer_customer_id
      ) VALUES (
        ${orgA}, ${caseA}, ${fundingSourceA}, 'FK-BAS-1', 'customer', ${customerB}
      )
    `).rejects.toThrow(/invoice_basis_payer_customer_same_org_fk/);
  });

  it('rental_reservations.customer_id rejects cross-org customer', async () => {
    await expect(h.admin`
      INSERT INTO rental_reservations (
        organization_id, rental_vehicle_id, customer_id, starts_at, ends_at
      ) VALUES (
        ${orgA}, ${rentalVehicleA}, ${customerB}, now(), now() + interval '1 day'
      )
    `).rejects.toThrow(/rental_reservations_customer_same_org_fk/);
  });

  // Sanity: same-org references DO work — proves the composite FK doesn't
  // over-reject when both sides match.
  it('same-org customer reference still works on vehicles', async () => {
    const [v] = await h.admin`
      INSERT INTO vehicles (
        organization_id, registration_number, ownership_type, owner_customer_id
      ) VALUES (
        ${orgA}, 'FKSANE1', 'unknown', ${customerA}
      ) RETURNING id, owner_customer_id
    `;
    expect(v!['owner_customer_id']).toBe(customerA);
  });

  // Sanity: NULL customer-id still works (the composite FK uses MATCH SIMPLE,
  // so a NULL key column makes the FK check trivially pass).
  it('NULL customer reference still works on vehicles', async () => {
    const [v] = await h.admin`
      INSERT INTO vehicles (organization_id, registration_number, ownership_type)
      VALUES (${orgA}, 'FKSANE2', 'unknown')
      RETURNING id, owner_customer_id
    `;
    expect(v!['owner_customer_id']).toBeNull();
  });

  // Silence unused-variable warnings: the threadA / customerA setup rows are
  // referenced in sanity assertions above; the field is here for future tests
  // that need a pre-existing thread in org A.
  it('setup data exists', () => {
    expect(threadA).toBeTruthy();
  });
});
