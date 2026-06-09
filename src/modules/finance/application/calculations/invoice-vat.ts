/**
 * Invoice VAT & basis totals — Single Source of Truth (CLAUDE.md § 4.5,
 * registered as the `invoice_line_vat` and `invoice_basis_total` metrics).
 *
 * Pure functions. The ONE authoritative place VAT and basis totals are
 * computed. The basis generator, the approval flow, the accounting export, the
 * UI preview, and the Dev inspector all call these — no inline money arithmetic
 * in presentation (the ESLint rule enforces this).
 *
 * Money is handled as numbers here and rounded to 2 decimals (øre). Callers
 * convert to/from the DB `numeric(14,2)` string representation at the boundary.
 */

/** Norwegian standard VAT rate (merverdiavgift). */
export const DEFAULT_VAT_RATE = 25;

/** Round to 2 decimals (øre) using round-half-up. */
export function roundOre(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface LineVatInput {
  /** Quantity (may be fractional, e.g. hours). */
  readonly quantity: number;
  /** Net unit price excl. VAT. */
  readonly unitPriceNet: number;
  /** VAT rate as a percentage, e.g. 25 for 25%. */
  readonly vatRate: number;
}

export interface LineVatResult {
  readonly lineNet: number;
  readonly lineVat: number;
  readonly lineGross: number;
}

/**
 * Per-line VAT. `lineNet = quantity × unitPriceNet`; VAT is applied to the net.
 * Each amount is independently rounded to øre so the stored line is internally
 * consistent (net + vat = gross exactly).
 */
export function calculateLineVat(input: LineVatInput): LineVatResult {
  const lineNet = roundOre(input.quantity * input.unitPriceNet);
  const lineVat = roundOre((lineNet * input.vatRate) / 100);
  const lineGross = roundOre(lineNet + lineVat);
  return { lineNet, lineVat, lineGross };
}

export interface BasisTotalsInput {
  readonly lines: ReadonlyArray<{
    readonly lineNet: number;
    readonly lineVat: number;
    readonly lineGross: number;
  }>;
}

export interface BasisTotalsResult {
  readonly netAmount: number;
  readonly vatAmount: number;
  readonly grossAmount: number;
}

/**
 * Sum line amounts into basis totals. Summing the already-rounded line amounts
 * (rather than re-deriving from a net total) guarantees the header equals the
 * sum of the printed lines — the invariant an auditor checks.
 */
export function calculateInvoiceBasisTotals(
  input: BasisTotalsInput,
): BasisTotalsResult {
  let net = 0;
  let vat = 0;
  let gross = 0;
  for (const line of input.lines) {
    net += line.lineNet;
    vat += line.lineVat;
    gross += line.lineGross;
  }
  return {
    netAmount: roundOre(net),
    vatAmount: roundOre(vat),
    grossAmount: roundOre(gross),
  };
}
