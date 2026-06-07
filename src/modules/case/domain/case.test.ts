import { describe, expect, it } from 'vitest';

import {
  validateFundingSet,
  validateFundingSource,
  type FundingSourceInput,
} from './case';

const base = (over: Partial<FundingSourceInput>): FundingSourceInput =>
  ({ kind: 'private_pay', label: 'x', ...over }) as FundingSourceInput;

describe('validateFundingSource', () => {
  it('insurance requires an insurer', () => {
    expect(validateFundingSource(base({ kind: 'insurance' }))).toHaveLength(1);
    expect(
      validateFundingSource(
        base({ kind: 'insurance', payerInsuranceId: crypto.randomUUID() }),
      ),
    ).toHaveLength(0);
    expect(
      validateFundingSource(
        base({
          kind: 'insurance',
          newClaim: { insuranceCompanyId: crypto.randomUUID() },
        }),
      ),
    ).toHaveLength(0);
  });

  it('private_pay requires a paying customer', () => {
    expect(validateFundingSource(base({ kind: 'private_pay' }))).toHaveLength(
      1,
    );
    expect(
      validateFundingSource(
        base({ kind: 'private_pay', payerCustomerId: crypto.randomUUID() }),
      ),
    ).toHaveLength(0);
  });

  it('warranty must reference a case', () => {
    expect(validateFundingSource(base({ kind: 'warranty' }))).toHaveLength(1);
    expect(
      validateFundingSource(
        base({ kind: 'warranty', referencesCaseId: crypto.randomUUID() }),
      ),
    ).toHaveLength(0);
  });

  it('internal_rework requires reason + reference + owner workshop', () => {
    const problems = validateFundingSource(base({ kind: 'internal_rework' }));
    expect(problems).toHaveLength(3);
    expect(
      validateFundingSource(
        base({
          kind: 'internal_rework',
          reworkReason: 'paint defect',
          referencesCaseId: crypto.randomUUID(),
          reworkOwnerWorkshopId: crypto.randomUUID(),
        }),
      ),
    ).toHaveLength(0);
  });

  it('goodwill requires an absorbing workshop', () => {
    expect(validateFundingSource(base({ kind: 'goodwill' }))).toHaveLength(1);
    expect(
      validateFundingSource(
        base({ kind: 'goodwill', reworkOwnerWorkshopId: crypto.randomUUID() }),
      ),
    ).toHaveLength(0);
  });

  it('a deductible requires a deductible payer', () => {
    const problems = validateFundingSource(
      base({
        kind: 'insurance',
        payerInsuranceId: crypto.randomUUID(),
        deductibleAmount: 4000,
      }),
    );
    expect(problems).toContain('A deductible requires a deductible payer.');
  });
});

describe('validateFundingSet', () => {
  it('validates a real three-funder scenario (Fremtind + Gjensidige + self-pay)', () => {
    const sources: FundingSourceInput[] = [
      {
        kind: 'insurance',
        label: 'Front – Fremtind',
        payerInsuranceId: crypto.randomUUID(),
        deductibleAmount: 4000,
        deductiblePayerCustomerId: crypto.randomUUID(),
      },
      {
        kind: 'insurance',
        label: 'Rear – Gjensidige',
        payerInsuranceId: crypto.randomUUID(),
      },
      {
        kind: 'private_pay',
        label: 'Scratch – customer pays',
        payerCustomerId: crypto.randomUUID(),
      },
    ];
    expect(validateFundingSet(sources)).toHaveLength(0);
  });

  it('prefixes problems with the funding index', () => {
    const problems = validateFundingSet([base({ kind: 'insurance' })]);
    expect(problems[0]).toMatch(/^Funding #1:/);
  });
});
