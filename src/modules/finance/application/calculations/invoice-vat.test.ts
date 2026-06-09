import { describe, expect, it } from 'vitest';

import {
  calculateInvoiceBasisTotals,
  calculateLineVat,
  DEFAULT_VAT_RATE,
  roundOre,
} from './invoice-vat';

describe('calculateLineVat', () => {
  it('applies the standard 25% VAT and keeps net + vat = gross', () => {
    const r = calculateLineVat({
      quantity: 1,
      unitPriceNet: 1000,
      vatRate: DEFAULT_VAT_RATE,
    });
    expect(r.lineNet).toBe(1000);
    expect(r.lineVat).toBe(250);
    expect(r.lineGross).toBe(1250);
    expect(roundOre(r.lineNet + r.lineVat)).toBe(r.lineGross);
  });

  it('handles fractional quantities (hours) and rounds to øre', () => {
    const r = calculateLineVat({
      quantity: 2.5,
      unitPriceNet: 990,
      vatRate: 25,
    });
    expect(r.lineNet).toBe(2475);
    expect(r.lineVat).toBe(618.75);
    expect(r.lineGross).toBe(3093.75);
  });

  it('supports a zero VAT rate', () => {
    const r = calculateLineVat({ quantity: 1, unitPriceNet: 500, vatRate: 0 });
    expect(r.lineVat).toBe(0);
    expect(r.lineGross).toBe(500);
  });

  it('handles negative amounts (deductible transfer line)', () => {
    const r = calculateLineVat({
      quantity: 1,
      unitPriceNet: -6000,
      vatRate: 25,
    });
    expect(r.lineNet).toBe(-6000);
    expect(r.lineVat).toBe(-1500);
    expect(r.lineGross).toBe(-7500);
  });
});

describe('calculateInvoiceBasisTotals', () => {
  it('sums the already-rounded line amounts (header = sum of lines)', () => {
    const totals = calculateInvoiceBasisTotals({
      lines: [
        { lineNet: 1000, lineVat: 250, lineGross: 1250 },
        { lineNet: 2475, lineVat: 618.75, lineGross: 3093.75 },
      ],
    });
    expect(totals.netAmount).toBe(3475);
    expect(totals.vatAmount).toBe(868.75);
    expect(totals.grossAmount).toBe(4343.75);
  });

  it('is zero for an empty basis', () => {
    const totals = calculateInvoiceBasisTotals({ lines: [] });
    expect(totals).toEqual({ netAmount: 0, vatAmount: 0, grossAmount: 0 });
  });

  it('nets a negative (deductible) line against the positives', () => {
    const totals = calculateInvoiceBasisTotals({
      lines: [
        { lineNet: 10000, lineVat: 2500, lineGross: 12500 },
        { lineNet: -6000, lineVat: -1500, lineGross: -7500 },
      ],
    });
    expect(totals.netAmount).toBe(4000);
    expect(totals.vatAmount).toBe(1000);
    expect(totals.grossAmount).toBe(5000);
  });
});
