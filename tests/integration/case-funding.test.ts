import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Case core + multi-funding integration suite (Sprint 6).
 *
 * Validates against real Postgres: case intake with the per-org case number,
 * the distinctive multi-funding model (the demoable Fremtind + Gjensidige +
 * self-pay scenario), funding validation rejection, claim creation, search,
 * and audit + outbox.
 */
describe('case core + funding', () => {
  let h: IsolationHarness;
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let fremtindId: string;
  let gjensidigeId: string;
  let payerCustomerId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000e1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner6@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Case Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    // A workshop for goodwill/rework owner refs.
    const [ws] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgId}, 'Oslo') RETURNING id
    `;
    workshopId = ws!['id'] as string;

    // Seed insurers (platform-shared) and grab two.
    const insurers = await h.admin`
      SELECT id, code FROM insurance_companies WHERE code IN ('fremtind','gjensidige')
    `;
    for (const row of insurers) {
      if (row['code'] === 'fremtind') fremtindId = row['id'] as string;
      if (row['code'] === 'gjensidige') gjensidigeId = row['id'] as string;
    }
    // If the platform catalog wasn't seeded in this DB, insert the two we need.
    if (!fremtindId) {
      const [f] = await h.admin`
        INSERT INTO insurance_companies (code, name) VALUES ('fremtind','Fremtind') RETURNING id
      `;
      fremtindId = f!['id'] as string;
    }
    if (!gjensidigeId) {
      const [g] = await h.admin`
        INSERT INTO insurance_companies (code, name) VALUES ('gjensidige','Gjensidige') RETURNING id
      `;
      gjensidigeId = g!['id'] as string;
    }
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctx = () => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId,
    accessibleWorkshopIds: [workshopId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000000ef',
  });

  it('creates a case with a per-org case number (YYYY-0001)', async () => {
    const customerRow = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Ola Hansen',
    });
    payerCustomerId = customerRow.id;

    const created = await caseModule.createCase(ctx(), {
      primaryCustomerId: payerCustomerId,
      incidentTag: 'Parking lot collision',
      fundingSources: [],
    });
    const year = new Date().getFullYear();
    expect(created.caseNumber).toBe(`${year}-0001`);

    const audit = await h.admin`
      SELECT action FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'cases' AND entity_id = ${created.id}
    `;
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('the demoable: one case funded by Fremtind + Gjensidige + self-pay', async () => {
    const created = await caseModule.createCase(ctx(), {
      primaryCustomerId: payerCustomerId,
      fundingSources: [
        {
          kind: 'insurance',
          label: 'Front – Fremtind',
          newClaim: { claimNumber: 'FR-100', insuranceCompanyId: fremtindId },
          deductibleAmount: 4000,
          deductiblePayerCustomerId: payerCustomerId,
        },
        {
          kind: 'insurance',
          label: 'Rear – Gjensidige',
          newClaim: { claimNumber: 'GJ-200', insuranceCompanyId: gjensidigeId },
        },
        {
          kind: 'private_pay',
          label: 'Scratch – customer pays',
          payerCustomerId,
        },
      ],
    });

    const funding = await caseModule.listFundingSources(ctx(), created.id);
    expect(funding).toHaveLength(3);
    expect(funding.map((f) => f.kind)).toEqual([
      'insurance',
      'insurance',
      'private_pay',
    ]);
    // Two insurance claims were created and linked.
    const claims = await h.admin`
      SELECT claim_number FROM insurance_claims WHERE organization_id = ${orgId}
      ORDER BY claim_number
    `;
    expect(claims.map((c) => c['claim_number'])).toEqual(['FR-100', 'GJ-200']);

    // Sequential case number.
    const year = new Date().getFullYear();
    expect(created.caseNumber).toBe(`${year}-0002`);

    // Funding-added events emitted.
    const events = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId} AND event_type = 'case.case.created'
    `;
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a case whose insurance funding has no insurer', async () => {
    await expect(
      caseModule.createCase(ctx(), {
        fundingSources: [{ kind: 'insurance', label: 'No insurer' }],
      }),
    ).rejects.toThrow(/INVALID_FUNDING/);
  });

  it('rejects internal_rework without reason/reference/owner', async () => {
    await expect(
      caseModule.createCase(ctx(), {
        fundingSources: [{ kind: 'internal_rework', label: 'Rework' }],
      }),
    ).rejects.toThrow(/INVALID_FUNDING/);
  });

  it('finds a case by claim number and by customer name', async () => {
    const byClaim = await caseModule.searchCases(ctx(), 'FR-100');
    expect(byClaim.length).toBeGreaterThanOrEqual(1);
    const byCustomer = await caseModule.searchCases(ctx(), 'Ola');
    expect(byCustomer.length).toBeGreaterThanOrEqual(1);
  });
});
