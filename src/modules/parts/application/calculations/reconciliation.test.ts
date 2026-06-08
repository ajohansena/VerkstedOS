import { describe, expect, it } from 'vitest';

import { reconcilePartRequirement } from './reconciliation';

describe('reconcilePartRequirement', () => {
  it('is not_ordered when nothing has been ordered or received', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 1,
      quantityOrdered: 0,
      quantityReceived: 0,
      quantityReturned: 0,
    });
    expect(r.state).toBe('not_ordered');
    expect(r.isFulfilled).toBe(false);
    expect(r.quantityOutstanding).toBe(1);
  });

  it('is under_ordered when ordered less than required', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 4,
      quantityOrdered: 2,
      quantityReceived: 0,
      quantityReturned: 0,
    });
    expect(r.state).toBe('under_ordered');
  });

  it('is awaiting_delivery when fully ordered but not yet received', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 2,
      quantityOrdered: 2,
      quantityReceived: 0,
      quantityReturned: 0,
    });
    expect(r.state).toBe('awaiting_delivery');
    expect(r.quantityOutstanding).toBe(2);
  });

  it('is received when net received covers the requirement', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 2,
      quantityOrdered: 2,
      quantityReceived: 2,
      quantityReturned: 0,
    });
    expect(r.state).toBe('received');
    expect(r.isFulfilled).toBe(true);
    expect(r.quantityOutstanding).toBe(0);
  });

  it('re-opens to awaiting_delivery after a return drops net below required', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 2,
      quantityOrdered: 2,
      quantityReceived: 2,
      quantityReturned: 1,
    });
    expect(r.quantityNetReceived).toBe(1);
    expect(r.isFulfilled).toBe(false);
    // ordered (2) still >= required (2) → awaiting the replacement delivery.
    expect(r.state).toBe('awaiting_delivery');
  });

  it('is over_received when net received exceeds the requirement (surplus)', () => {
    const r = reconcilePartRequirement({
      quantityRequired: 1,
      quantityOrdered: 2,
      quantityReceived: 2,
      quantityReturned: 0,
    });
    expect(r.state).toBe('over_received');
    expect(r.isFulfilled).toBe(true);
  });
});
