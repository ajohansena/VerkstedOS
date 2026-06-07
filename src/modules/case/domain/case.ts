import { z } from 'zod';

/**
 * Case & funding-source domain (docs/03-data-model.md, ADR-013). Pure types +
 * Zod validation + the multi-funding invariant rules. No I/O.
 */

export const fundingSourceKindSchema = z.enum([
  'insurance',
  'private_pay',
  'warranty',
  'goodwill',
  'internal_rework',
]);

export type FundingSourceKind = z.infer<typeof fundingSourceKindSchema>;

/** A funding source to attach during intake (before the case/claim ids exist). */
export const fundingSourceInputSchema = z.object({
  kind: fundingSourceKindSchema,
  label: z.string().trim().min(1, 'Label is required').max(256),
  payerCustomerId: z.string().uuid().optional(),
  payerInsuranceId: z.string().uuid().optional(),
  /** Existing claim, or a new claim to create (insurer + claim number). */
  insuranceClaimId: z.string().uuid().optional(),
  newClaim: z
    .object({
      claimNumber: z.string().trim().max(64).optional(),
      insuranceCompanyId: z.string().uuid().optional(),
    })
    .optional(),
  deductibleAmount: z.number().nonnegative().optional(),
  deductiblePayerCustomerId: z.string().uuid().optional(),
  coverageCapAmount: z.number().nonnegative().optional(),
  referencesCaseId: z.string().uuid().optional(),
  reworkReason: z.string().trim().max(2000).optional(),
  reworkOwnerWorkshopId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type FundingSourceInput = z.infer<typeof fundingSourceInputSchema>;

export const createCaseSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  primaryCustomerId: z.string().uuid().optional(),
  incidentTag: z.string().trim().max(512).optional(),
  currentWorkshopId: z.string().uuid().optional(),
  parentCaseId: z.string().uuid().optional(),
  fundingSources: z.array(fundingSourceInputSchema).default([]),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

/**
 * Per-kind funding-source invariants (the multi-funding rules). Returns an
 * array of human-readable problems; empty = valid. Pure — unit-tested.
 *
 *   - insurance:       must identify an insurer (existing claim, new claim with
 *                      insurer, or payer_insurance_id).
 *   - private_pay:     must name a paying customer.
 *   - warranty:        must reference the originating case.
 *   - goodwill:        workshop absorbs — owner workshop required.
 *   - internal_rework: rework_reason + references_case_id + owner workshop required.
 *   - a deductible amount requires a deductible payer.
 */
export function validateFundingSource(fs: FundingSourceInput): string[] {
  const problems: string[] = [];

  switch (fs.kind) {
    case 'insurance': {
      const hasInsurer =
        Boolean(fs.insuranceClaimId) ||
        Boolean(fs.payerInsuranceId) ||
        Boolean(fs.newClaim?.insuranceCompanyId);
      if (!hasInsurer) {
        problems.push(
          'Insurance funding requires an insurer (claim or insurance company).',
        );
      }
      break;
    }
    case 'private_pay':
      if (!fs.payerCustomerId) {
        problems.push('Private-pay funding requires a paying customer.');
      }
      break;
    case 'warranty':
      if (!fs.referencesCaseId) {
        problems.push('Warranty funding must reference the originating case.');
      }
      break;
    case 'goodwill':
      if (!fs.reworkOwnerWorkshopId) {
        problems.push('Goodwill funding requires an absorbing workshop.');
      }
      break;
    case 'internal_rework':
      if (!fs.reworkReason?.trim()) {
        problems.push('Internal rework requires a rework reason.');
      }
      if (!fs.referencesCaseId) {
        problems.push('Internal rework must reference the originating case.');
      }
      if (!fs.reworkOwnerWorkshopId) {
        problems.push('Internal rework requires an absorbing workshop.');
      }
      break;
  }

  if (
    fs.deductibleAmount !== undefined &&
    fs.deductibleAmount > 0 &&
    !fs.deductiblePayerCustomerId
  ) {
    problems.push('A deductible requires a deductible payer.');
  }

  return problems;
}

/** Validate a full set of funding sources for a case. */
export function validateFundingSet(sources: FundingSourceInput[]): string[] {
  return sources.flatMap((fs, i) =>
    validateFundingSource(fs).map((p) => `Funding #${i + 1}: ${p}`),
  );
}
