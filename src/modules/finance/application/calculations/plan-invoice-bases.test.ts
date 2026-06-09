import { describe, expect, it } from 'vitest';

import {
  planInvoiceBases,
  type PlannerFundingSource,
} from './plan-invoice-bases';

const ESTIMATE = {
  bodyLaborAmount: 10000,
  paintLaborAmount: 4000,
  paintMaterialAmount: 2000,
  partsAmount: 8000,
  externalWorkAmount: 0,
  vatRate: 25,
};

function insurance(over: Partial<PlannerFundingSource> = {}): PlannerFundingSource {
  return {
    id: 'fs-insurance',
    kind: 'insurance',
    sequenceNo: 0,
    deductibleAmount: null,
    deductiblePayerCustomerId: null,
    payerCustomerId: null,
    payerInsuranceId: 'ins-1',
    ...over,
  };
}

function privatePay(over: Partial<PlannerFundingSource> = {}): PlannerFundingSource {
  return {
    id: 'fs-private',
    kind: 'private_pay',
    sequenceNo: 0,
    deductibleAmount: null,
    deductiblePayerCustomerId: null,
    payerCustomerId: 'cust-1',
    payerInsuranceId: null,
    ...over,
  };
}

describe('planInvoiceBases', () => {
  it('returns nothing when there are no funding sources', () => {
    expect(
      planInvoiceBases({ fundingSources: [], estimate: ESTIMATE }),
    ).toEqual([]);
  });

  it('returns nothing when the estimate carries no amounts', () => {
    const bases = planInvoiceBases({
      fundingSources: [privatePay()],
      estimate: {
        bodyLaborAmount: 0,
        paintLaborAmount: 0,
        paintMaterialAmount: 0,
        partsAmount: 0,
        externalWorkAmount: 0,
        vatRate: 25,
      },
    });
    expect(bases).toEqual([]);
  });

  it('builds a single standard basis for a private payer', () => {
    const bases = planInvoiceBases({
      fundingSources: [privatePay()],
      estimate: ESTIMATE,
    });
    expect(bases).toHaveLength(1);
    const b = bases[0]!;
    expect(b.kind).toBe('standard');
    expect(b.payerType).toBe('private_pay');
    // 4 non-zero categories → 4 lines.
    expect(b.lines).toHaveLength(4);
    expect(b.netAmount).toBe(24000);
    expect(b.vatAmount).toBe(6000);
    expect(b.grossAmount).toBe(30000);
  });

  it('produces an internal basis for goodwill (workshop absorbs cost)', () => {
    const bases = planInvoiceBases({
      fundingSources: [
        privatePay({ id: 'fs-gw', kind: 'goodwill', payerCustomerId: null }),
      ],
      estimate: ESTIMATE,
    });
    expect(bases).toHaveLength(1);
    expect(bases[0]!.kind).toBe('internal');
    expect(bases[0]!.payerType).toBe('goodwill');
  });

  it('carves the deductible into its own basis; the two sum to the estimate', () => {
    const bases = planInvoiceBases({
      fundingSources: [
        insurance({
          deductibleAmount: 6000,
          deductiblePayerCustomerId: 'cust-1',
        }),
      ],
      estimate: ESTIMATE,
    });
    expect(bases).toHaveLength(2);

    const insuranceBasis = bases.find((b) => b.kind === 'standard')!;
    const deductibleBasis = bases.find((b) => b.kind === 'deductible')!;

    // Deductible basis is billed to the customer for exactly the deductible.
    expect(deductibleBasis.payerType).toBe('deductible');
    expect(deductibleBasis.payerCustomerId).toBe('cust-1');
    expect(deductibleBasis.netAmount).toBe(6000);
    expect(deductibleBasis.deductibleOfFundingSourceId).toBe('fs-insurance');

    // Insurance basis is reduced by the deductible.
    expect(insuranceBasis.netAmount).toBe(24000 - 6000);

    // The two bases together still equal the full estimate net.
    expect(insuranceBasis.netAmount + deductibleBasis.netAmount).toBe(24000);
  });

  it('does not carve a deductible for a non-insurance primary', () => {
    const bases = planInvoiceBases({
      fundingSources: [privatePay({ deductibleAmount: 6000 })],
      estimate: ESTIMATE,
    });
    expect(bases).toHaveLength(1);
    expect(bases[0]!.netAmount).toBe(24000);
  });

  it('orders funding sources by sequence (lowest is primary payer)', () => {
    const bases = planInvoiceBases({
      fundingSources: [
        privatePay({ id: 'fs-second', sequenceNo: 5 }),
        insurance({ id: 'fs-first', sequenceNo: 1 }),
      ],
      estimate: ESTIMATE,
    });
    expect(bases[0]!.fundingSourceId).toBe('fs-first');
    expect(bases[0]!.payerType).toBe('insurance');
  });
});
