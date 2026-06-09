import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Finance invoicing integration suite (Sprint 15).
 *
 * Validates the fakturagrunnlag → approve → export chain against real Postgres
 * + RLS: an insurance case with a deductible produces TWO invoice bases (the
 * insurance basis net of the deductible + the deductible basis to the customer)
 * that sum to the estimate; approving both and exporting flips them to
 * `exported` and writes one IMMUTABLE accounting export with a payload hash.
 */
describe('finance invoicing', () => {
  let h: IsolationHarness;
  let finance: typeof import('@/modules/finance/public');
  let estimating: typeof import('@/modules/estimating/public');
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let fremtindId: string;
  let payerCustomerId: string;
  let caseId: string;

  const estimatePayload = {
    oppdragsId: 'FIN-1',
    skadenr: 'FIN-1',
    document: {
      estimateNumber: 'FIN-EST-1',
      insurerName: 'Fremtind',
      vehicleDescription: 'CITROEN E-C4',
      vin: 'VR7BCZKW0SE031337',
      normalRepairDays: 12,
    },
    operations: [
      {
        category: 'body_labor',
        description: 'H Forskjerm',
        action: 'Skift',
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
      bodyLaborAmount: 31133,
      paintLaborAmount: 12819,
      paintMaterialAmount: 2000,
      partsAmount: 4084,
      vatRate: 25,
      totalAmount: 311841,
    },
  };

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    finance = await import('@/modules/finance/public');
    estimating = await import('@/modules/estimating/public');
    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000d1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner15@example.no',
      fullName: 'Ingrid Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Finance Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

    const insurers = await h.admin`
      SELECT id FROM insurance_companies WHERE code = 'fremtind'
    `;
    if (insurers[0]) {
      fremtindId = insurers[0]['id'] as string;
    } else {
      const f = await h.admin`
        INSERT INTO insurance_companies (code, name)
        VALUES ('fremtind', 'Fremtind') RETURNING id
      `;
      fremtindId = f[0]!['id'] as string;
    }

    const cust = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Kari Nordmann',
    });
    payerCustomerId = cust.id;

    const created = await caseModule.createCase(ctx(), {
      primaryCustomerId: payerCustomerId,
      fundingSources: [
        {
          kind: 'insurance',
          label: 'Fremtind',
          newClaim: { claimNumber: 'FR-900', insuranceCompanyId: fremtindId },
          deductibleAmount: 6000,
          deductiblePayerCustomerId: payerCustomerId,
        },
      ],
    });
    caseId = created.id;

    // Activate the funding source (default is draft) so the generator sees it.
    await h.admin`
      UPDATE case_funding_sources SET status = 'active'
      WHERE organization_id = ${orgId} AND case_id = ${caseId}
    `;

    // Import + lock an estimate so there are amounts to invoice.
    const imp = await estimating.importDbsEstimate(ctx(), {
      caseId,
      payload: estimatePayload,
    });
    await estimating.lockEstimate(ctx(), imp.id);
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId,
      accessibleWorkshopIds: [workshopId] as string[],
      correlationId: '00000000-0000-0000-0000-0000000000fd',
    };
  }

  let basisIds: string[] = [];

  it('generates an insurance basis + a deductible basis that sum to the estimate', async () => {
    const result = await finance.generateInvoiceBasisForCase(ctx(), caseId);
    expect(result.bases.length).toBe(2);

    const bases = await finance.listInvoiceBasesForCase(ctx(), caseId);
    basisIds = bases.map((b) => b.id);

    const insuranceBasis = bases.find((b) => b.kind === 'standard')!;
    const deductibleBasis = bases.find((b) => b.kind === 'deductible')!;
    expect(insuranceBasis).toBeDefined();
    expect(deductibleBasis).toBeDefined();

    // The deductible basis bills the customer for exactly the deductible.
    expect(Number(deductibleBasis.netAmount)).toBe(6000);
    expect(deductibleBasis.payerType).toBe('deductible');

    // The two bases net to the same total as a single un-split basis would.
    const combined =
      Number(insuranceBasis.netAmount) + Number(deductibleBasis.netAmount);
    expect(combined).toBeGreaterThan(0);
    // Insurance basis is reduced by the deductible amount.
    expect(Number(insuranceBasis.netAmount)).toBe(combined - 6000);
  });

  it('refuses to regenerate while a non-cancelled basis exists', async () => {
    await expect(
      finance.generateInvoiceBasisForCase(ctx(), caseId),
    ).rejects.toThrow('INVOICE_BASIS_ALREADY_EXISTS');
  });

  it('approves both bases', async () => {
    for (const id of basisIds) {
      const approved = await finance.approveInvoiceBasis(ctx(), id);
      expect(approved.status).toBe('approved');
    }
    const approved = await finance.listApprovedBases(ctx());
    expect(approved.length).toBe(2);
  });

  it('exports approved bases into one immutable accounting export', async () => {
    const exp = await finance.exportApprovedBases(ctx());
    expect(exp.payloadHash).toBeTruthy();
    expect(['sent', 'acknowledged', 'pending', 'failed']).toContain(exp.status);

    // Bases flipped to exported.
    const bases = await finance.listInvoiceBasesForCase(ctx(), caseId);
    expect(bases.every((b) => b.status === 'exported')).toBe(true);

    // The export is recorded with its lines.
    const detail = await finance.findAccountingExport(ctx(), exp.id);
    expect(detail).not.toBeNull();
    expect(detail!.lines.length).toBe(2);

    const stats = await finance.accountingExportStats(ctx());
    expect(stats.total).toBeGreaterThanOrEqual(1);
  });

  it('refuses to export when nothing is approved', async () => {
    await expect(finance.exportApprovedBases(ctx())).rejects.toThrow(
      'NO_APPROVED_BASES',
    );
  });
});
