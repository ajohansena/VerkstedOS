/**
 * Part reconciliation — Single Source of Truth (CLAUDE.md § 4.5,
 * docs/03-data-model.md "part_reconciliation_status").
 *
 * Pure function. The ONE authoritative place a part requirement's
 * estimated-vs-ordered-vs-received-vs-returned position is computed. The case
 * parts panel, the coordinator dashboard, and the Dev inspector all call this.
 *
 * TakstKontroll (§ 4.7): keeps the estimated vs actual quantities separable and
 * case-traceable — never collapsed into a single "done" flag.
 */

export interface ReconciliationInput {
  /** Quantity the requirement needs. */
  quantityRequired: number;
  /** Sum of quantity_ordered across PO lines for this requirement. */
  quantityOrdered: number;
  /** Sum of quantity_received across receipt lines + inventory withdrawals. */
  quantityReceived: number;
  /** Sum of quantity_returned across return lines. */
  quantityReturned: number;
}

export type ReconciliationState =
  | 'not_ordered' // nothing on a PO and nothing from stock yet
  | 'under_ordered' // ordered less than required
  | 'awaiting_delivery' // ordered enough, not all received
  | 'received' // received >= required (net of returns)
  | 'over_received'; // received more than required (surplus on hand)

export interface ReconciliationResult {
  quantityRequired: number;
  quantityOrdered: number;
  /** Received net of returns. */
  quantityNetReceived: number;
  quantityOutstanding: number; // required − netReceived, floored at 0
  state: ReconciliationState;
  /** True when the net received covers the requirement (closed position). */
  isFulfilled: boolean;
}

export function reconcilePartRequirement(
  input: ReconciliationInput,
): ReconciliationResult {
  const netReceived = input.quantityReceived - input.quantityReturned;
  const outstanding = Math.max(0, input.quantityRequired - netReceived);

  let state: ReconciliationState;
  if (netReceived > input.quantityRequired) {
    state = 'over_received';
  } else if (netReceived >= input.quantityRequired) {
    state = 'received';
  } else if (input.quantityOrdered >= input.quantityRequired) {
    state = 'awaiting_delivery';
  } else if (input.quantityOrdered > 0) {
    state = 'under_ordered';
  } else {
    state = 'not_ordered';
  }

  return {
    quantityRequired: input.quantityRequired,
    quantityOrdered: input.quantityOrdered,
    quantityNetReceived: netReceived,
    quantityOutstanding: outstanding,
    state,
    isFulfilled: netReceived >= input.quantityRequired,
  };
}
