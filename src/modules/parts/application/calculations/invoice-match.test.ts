import { describe, expect, it } from 'vitest';

import { calculateInvoiceMatch } from './invoice-match';

describe('calculateInvoiceMatch', () => {
  it('is not_invoiced when received but nothing billed', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 0,
      quantityCredited: 0,
    });
    expect(r.state).toBe('not_invoiced');
    expect(r.quantityNetInvoiced).toBe(0);
    expect(r.quantityUninvoiced).toBe(4);
    expect(r.isMatched).toBe(false);
  });

  it('is under_invoiced when billed less than received', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 3,
      quantityCredited: 0,
    });
    expect(r.state).toBe('under_invoiced');
    expect(r.quantityUninvoiced).toBe(1);
    expect(r.isMatched).toBe(false);
  });

  it('is invoiced (clean three-way match) when net equals received', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 4,
      quantityCredited: 0,
    });
    expect(r.state).toBe('invoiced');
    expect(r.quantityUninvoiced).toBe(0);
    expect(r.isMatched).toBe(true);
  });

  it('is over_invoiced when billed more than received', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 6,
      quantityCredited: 0,
    });
    expect(r.state).toBe('over_invoiced');
    expect(r.quantityNetInvoiced).toBe(6);
    expect(r.quantityUninvoiced).toBe(-2);
    expect(r.isMatched).toBe(false);
  });

  it('nets credits against invoiced quantity (back to a clean match)', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 6,
      quantityCredited: 2,
    });
    expect(r.quantityNetInvoiced).toBe(4);
    expect(r.state).toBe('invoiced');
    expect(r.isMatched).toBe(true);
  });

  it('is credited when fully reversed by credit notes', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: 4,
      quantityInvoiced: 4,
      quantityCredited: 4,
    });
    expect(r.quantityNetInvoiced).toBe(0);
    expect(r.state).toBe('credited');
  });

  it('floors negative received at 0', () => {
    const r = calculateInvoiceMatch({
      quantityReceived: -3,
      quantityInvoiced: 0,
      quantityCredited: 0,
    });
    expect(r.quantityReceived).toBe(0);
    expect(r.state).toBe('not_invoiced');
  });
});
