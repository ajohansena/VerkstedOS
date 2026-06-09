import {
  calculateInvoiceBasisTotals,
  calculateLineVat,
  DEFAULT_VAT_RATE,
} from './invoice-vat';

/**
 * Invoice-basis planner (Sprint 15) — pure allocation of estimate amounts to
 * one basis per active funding source, including the Norwegian deductible
 * (egenandel) split. No I/O; fully testable. The generation service turns the
 * plan into rows; this function owns the ALLOCATION RULES.
 *
 * MVP allocation (No-Cleverness Rule): the first active funding source by
 * sequence is the primary payer and receives all estimate category lines. If
 * that primary is an insurance source with a deductible, the deductible is
 * carved into its own basis to the deductible payer and a matching negative
 * line reduces the insurance basis — so the two bases sum to the estimate.
 *
 * Goodwill / internal_rework as the primary produce an `internal` basis (the
 * workshop absorbs the cost) which flows to accounting separately, never as an
 * external invoice. Per-line funding allocation across multiple external payers
 * is a documented follow-up.
 */

export type FundingKind =
  | 'insurance'
  | 'private_pay'
  | 'warranty'
  | 'goodwill'
  | 'internal_rework';

export type BasisKind = 'standard' | 'deductible' | 'internal';

export type BasisLineKind =
  | 'body_labor'
  | 'paint_labor'
  | 'paint_material'
  | 'parts'
  | 'external_work'
  | 'deductible'
  | 'other';

export interface PlannerFundingSource {
  readonly id: string;
  readonly kind: FundingKind;
  readonly sequenceNo: number;
  readonly deductibleAmount: number | null;
  readonly deductiblePayerCustomerId: string | null;
  readonly payerCustomerId: string | null;
  readonly payerInsuranceId: string | null;
}

export interface PlannerEstimateAmounts {
  readonly bodyLaborAmount: number | null;
  readonly paintLaborAmount: number | null;
  readonly paintMaterialAmount: number | null;
  readonly partsAmount: number | null;
  readonly externalWorkAmount: number | null;
  readonly vatRate: number | null;
}

export interface PlannedLine {
  readonly lineKind: BasisLineKind;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceNet: number;
  readonly vatRate: number;
  readonly lineNet: number;
  readonly lineVat: number;
  readonly lineGross: number;
  readonly sourceRef: string | null;
}

export interface PlannedBasis {
  readonly fundingSourceId: string;
  readonly kind: BasisKind;
  readonly payerType: string;
  readonly payerCustomerId: string | null;
  readonly payerInsuranceId: string | null;
  readonly deductibleOfFundingSourceId: string | null;
  readonly lines: PlannedLine[];
  readonly netAmount: number;
  readonly vatAmount: number;
  readonly grossAmount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  body_labor: 'Karosseriarbeid',
  paint_labor: 'Lakkeringsarbeid',
  paint_material: 'Lakkmateriell',
  parts: 'Deler',
  external_work: 'Eksternt arbeid',
};

function basisKindForFunding(kind: FundingKind): BasisKind {
  if (kind === 'goodwill' || kind === 'internal_rework') return 'internal';
  return 'standard';
}

function buildLine(
  lineKind: BasisLineKind,
  description: string,
  unitPriceNet: number,
  vatRate: number,
): PlannedLine {
  const { lineNet, lineVat, lineGross } = calculateLineVat({
    quantity: 1,
    unitPriceNet,
    vatRate,
  });
  return {
    lineKind,
    description,
    quantity: 1,
    unitPriceNet,
    vatRate,
    lineNet,
    lineVat,
    lineGross,
    sourceRef: null,
  };
}

function finalize(
  partial: Omit<PlannedBasis, 'netAmount' | 'vatAmount' | 'grossAmount'>,
): PlannedBasis {
  const totals = calculateInvoiceBasisTotals({ lines: partial.lines });
  return {
    ...partial,
    netAmount: totals.netAmount,
    vatAmount: totals.vatAmount,
    grossAmount: totals.grossAmount,
  };
}

export interface PlanInput {
  readonly fundingSources: ReadonlyArray<PlannerFundingSource>;
  readonly estimate: PlannerEstimateAmounts;
}

/**
 * Produce the set of invoice bases for a case. Returns an empty array when
 * there are no active funding sources or the estimate carries no amounts.
 */
export function planInvoiceBases(input: PlanInput): PlannedBasis[] {
  const sorted = [...input.fundingSources].sort(
    (a, b) => a.sequenceNo - b.sequenceNo,
  );
  const primary = sorted[0];
  if (!primary) return [];

  const vatRate = input.estimate.vatRate ?? DEFAULT_VAT_RATE;

  const categories: Array<[BasisLineKind, number | null]> = [
    ['body_labor', input.estimate.bodyLaborAmount],
    ['paint_labor', input.estimate.paintLaborAmount],
    ['paint_material', input.estimate.paintMaterialAmount],
    ['parts', input.estimate.partsAmount],
    ['external_work', input.estimate.externalWorkAmount],
  ];

  const primaryLines: PlannedLine[] = [];
  for (const [kind, amount] of categories) {
    if (amount != null && amount !== 0) {
      primaryLines.push(
        buildLine(kind, CATEGORY_LABELS[kind] ?? kind, amount, vatRate),
      );
    }
  }

  if (primaryLines.length === 0) return [];

  const bases: PlannedBasis[] = [];

  const deductible = primary.deductibleAmount ?? 0;
  const hasDeductible =
    primary.kind === 'insurance' && deductible > 0;

  if (hasDeductible) {
    // Negative transfer line on the insurance basis.
    primaryLines.push(
      buildLine('deductible', 'Egenandel (trekkes fra)', -deductible, vatRate),
    );
  }

  bases.push(
    finalize({
      fundingSourceId: primary.id,
      kind: basisKindForFunding(primary.kind),
      payerType: primary.kind,
      payerCustomerId: primary.payerCustomerId,
      payerInsuranceId: primary.payerInsuranceId,
      deductibleOfFundingSourceId: null,
      lines: primaryLines,
    }),
  );

  if (hasDeductible) {
    bases.push(
      finalize({
        fundingSourceId: primary.id,
        kind: 'deductible',
        payerType: 'deductible',
        payerCustomerId: primary.deductiblePayerCustomerId,
        payerInsuranceId: null,
        deductibleOfFundingSourceId: primary.id,
        lines: [
          buildLine('deductible', 'Egenandel', deductible, vatRate),
        ],
      }),
    );
  }

  return bases;
}
