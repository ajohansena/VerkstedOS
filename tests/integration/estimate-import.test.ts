import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Estimate import integration suite (Sprint 7).
 *
 * Validates against real Postgres (migrations incl. estimate tables + RLS):
 * DBS import as an immutable version, per-line funding allocation, lock +
 * supersession, periods preserved verbatim, and the locked-immutability RLS
 * guard. Uses the real EN64251 numbers where it matters.
 */
describe('estimate import (DBS)', () => {
  let h: IsolationHarness;
  let estimating: typeof import('@/modules/estimating/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;

  const payload = (estimateNumber: string) => ({
    oppdragsId: '26079539T2',
    skadenr: '79536781,675',
    document: {
      estimateNumber,
      insurerName: 'Gjensidige, Øst',
      ownerName: 'Dnb Bank ASA',
      vehicleDescription: 'CITROEN E-C4 KOMBI-KUPE 5D',
      vin: 'VR7BCZKW0SE031337',
      mileageKm: 22056,
      normalRepairDays: 12,
    },
    operations: [
      {
        category: 'body_labor',
        description: 'H Forskjerm',
        action: 'Skift',
        side: 'H',
        timePeriods: 3260,
        laborRate: 955,
      },
    ],
    paintLines: [
      { description: 'Lakkarbeide', timePeriods: 1091, laborRate: 1175 },
    ],
    parts: [
      {
        partNumber: '9831194480',
        description: 'H Forskjerm',
        listPrice: 4083.66,
        amount: 4083.66,
      },
    ],
    totals: {
      bodyLaborPeriods: 3260,
      paintLaborPeriods: 1091,
      totalAmount: 311841,
      fixedPriceAgreement: 290000,
    },
  });

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    estimating = await import('@/modules/estimating/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000f1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner7@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Estimate Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseId = created.id;
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
      correlationId: '00000000-0000-0000-0000-0000000000fa',
    };
  }

  it('imports a DBS estimate as version 1 (draft) preserving periods', async () => {
    const imp = await estimating.importDbsEstimate(ctx(), {
      caseId,
      payload: payload('EN64251'),
    });
    expect(imp.versionNumber).toBe(1);
    expect(imp.kind).toBe('original');
    expect(imp.status).toBe('draft');
    expect(imp.oppdragsId).toBe('26079539T2');

    const ops = await estimating.listOperations(ctx(), imp.id);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.timePeriods).toBe(3260); // periods verbatim
    expect(ops[0]!.side).toBe('H');

    // SSoT periods->hours.
    expect(estimating.periodsToHours(ops[0]!.timePeriods)).toBeCloseTo(32.6, 5);

    const audit = await h.admin`
      SELECT action FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'estimate_imports'
    `;
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('allocates a funding source to an operation line while unlocked', async () => {
    // Create a funding source on the case, then allocate an operation to it.
    const customer = await import('@/modules/customer/public');
    const payer = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Payer',
    });
    await caseModule.addFundingSource(
      ctx(),
      caseId,
      { kind: 'private_pay', label: 'Self pay', payerCustomerId: payer.id },
      1,
    );
    const funding = await caseModule.listFundingSources(ctx(), caseId);
    const fsId = funding[0]!.id;

    const imports = await estimating.listImportsForCase(ctx(), caseId);
    const ops = await estimating.listOperations(ctx(), imports[0]!.id);

    await estimating.allocateOperationFunding(ctx(), {
      operationId: ops[0]!.id,
      fundingSourceId: fsId,
    });

    const after = await estimating.listOperations(ctx(), imports[0]!.id);
    expect(after[0]!.fundingSourceId).toBe(fsId);
  });

  it('locks the estimate (immutable from here)', async () => {
    const imports = await estimating.listImportsForCase(ctx(), caseId);
    const v1 = imports[0]!;
    await estimating.lockEstimate(ctx(), v1.id);

    const locked = await estimating.findImportById(ctx(), v1.id);
    expect(locked!.status).toBe('locked');
    expect(locked!.lockedAt).not.toBeNull();
  });

  it('blocks funding allocation on a locked estimate', async () => {
    const imports = await estimating.listImportsForCase(ctx(), caseId);
    const v1 = imports.find((i) => i.versionNumber === 1)!;
    const ops = await estimating.listOperations(ctx(), v1.id);
    await expect(
      estimating.allocateOperationFunding(ctx(), {
        operationId: ops[0]!.id,
        fundingSourceId: null,
      }),
    ).rejects.toThrow(/ESTIMATE_LOCKED/);
  });

  it('RLS prevents UPDATE of a locked estimate operation by the app role', async () => {
    const imports = await estimating.listImportsForCase(ctx(), caseId);
    const v1 = imports.find((i) => i.versionNumber === 1)!;
    const updated = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`UPDATE estimate_operations SET description = 'tampered'
                WHERE estimate_import_id = ${v1.id}`;
    });
    expect(updated.count).toBe(0); // immutability guard
  });

  it('a supplement supersedes the original on lock', async () => {
    const supplement = await estimating.importDbsEstimate(ctx(), {
      caseId,
      payload: payload('EN64251-S1'),
    });
    expect(supplement.versionNumber).toBe(2);
    expect(supplement.kind).toBe('supplement');

    await estimating.lockEstimate(ctx(), supplement.id);

    const imports = await estimating.listImportsForCase(ctx(), caseId);
    const v1 = imports.find((i) => i.versionNumber === 1)!;
    const v2 = imports.find((i) => i.versionNumber === 2)!;
    expect(v1.status).toBe('superseded');
    expect(v2.status).toBe('locked');
    expect(v2.supersedesId).toBe(v1.id);
  });

  it('lands a raw payload in the integration inbox', async () => {
    const { inboxId } = await estimating.receiveDbsPayload({
      organizationId: orgId,
      externalRef: '26079539T2',
      payload: payload('EN64251-INBOX'),
    });
    const rows = await h.admin`
      SELECT status, source FROM integration_inbox WHERE id = ${inboxId}
    `;
    expect(rows[0]!['status']).toBe('received');
    expect(rows[0]!['source']).toBe('dbs');
  });
});
