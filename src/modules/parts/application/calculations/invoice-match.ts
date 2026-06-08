/**
 * Supplier-invoice match — Single Source of Truth (CLAUDE.md § 4.5,
 * registered as the `supplier_invoice_match` metric).
 *
 * Pure function. Computes how a part requirement's RECEIVED quantity reconciles
 * against what has been INVOICED and CREDITED by the supplier. This is the
 * three-way match (ordered → received → invoiced) the parts coordinator uses to
 * approve supplier invoices for payment.
 *
 * TakstKontroll (§ 4.7): received vs invoiced vs credited stay separable and
 * case-traceable — never collapsed into a single "paid" flag.
 */

export interface InvoiceMatchInput {
  /** Net received for the requirement (received − returned), floored at 0. */
  quantityReceived: number;
  /** Sum of invoiced quantity across supplier invoice lines. */
  quantityInvoiced: number;
  /** Sum of credited quantity across supplier credit note lines. */
  quantityCredited: number;
}

export type InvoiceMatchState =
  | 'not_invoiced' // received something, nothing billed yet
  | 'under_invoiced' // billed less than received (awaiting more invoices)
  | 'invoiced' // net invoiced matches received (clean three-way match)
  | 'over_invoiced' // billed more than received (dispute / needs credit)
  | 'credited'; // fully reversed by credit notes (net invoiced ≤ 0)

export interface InvoiceMatchResult {
  quantityReceived: number;
  quantityInvoiced: number;
  quantityCredited: number;
  /** Invoiced net of credits. */
  quantityNetInvoiced: number;
  /** received − netInvoiced (positive = still to be billed). */
  quantityUninvoiced: number;
  state: InvoiceMatchState;
  /** True when net invoiced equals received (a clean match). */
  isMatched: boolean;
}

const EPSILON = 1e-9;

export function calculateInvoiceMatch(
  input: InvoiceMatchInput,
): InvoiceMatchResult {
  const received = Math.max(0, input.quantityReceived);
  const netInvoiced = input.quantityInvoiced - input.quantityCredited;
  const uninvoiced = received - netInvoiced;

  let state: InvoiceMatchState;
  if (input.quantityCredited > 0 && netInvoiced <= EPSILON) {
    state = 'credited';
  } else if (netInvoiced <= EPSILON) {
    state = 'not_invoiced';
  } else if (netInvoiced > received + EPSILON) {
    state = 'over_invoiced';
  } else if (Math.abs(netInvoiced - received) <= EPSILON) {
    state = 'invoiced';
  } else {
    state = 'under_invoiced';
  }

  return {
    quantityReceived: received,
    quantityInvoiced: input.quantityInvoiced,
    quantityCredited: input.quantityCredited,
    quantityNetInvoiced: netInvoiced,
    quantityUninvoiced: uninvoiced,
    state,
    isMatched: Math.abs(netInvoiced - received) <= EPSILON,
  };
}
