import { describe, expect, it } from 'vitest';

import { DbsParseError, parseDbsEstimate } from './dbs-parser';

const validPayload = {
  oppdragsId: '26079539T2',
  skadenr: '79536781,675',
  document: {
    estimateNumber: 'EN64251',
    insurerName: 'Gjensidige, Øst',
    ownerName: 'Dnb Bank ASA',
    damageType: 'Kasko',
    vehicleDescription: 'CITROEN E-C4 KOMBI-KUPE 5D',
    vin: 'VR7BCZKW0SE031337',
    mileageKm: 22056,
    normalRepairDays: 12,
  },
  operations: [
    {
      category: 'body_labor',
      description: 'H Forskjerm',
      action: 'Skift',
      side: 'H',
      timePeriods: 3260,
      laborRate: 955,
    },
  ],
  paintLines: [
    { description: 'Lakkarbeide', timePeriods: 1091, laborRate: 1175 },
  ],
  parts: [
    {
      partNumber: '9831194480',
      description: 'H Forskjerm',
      listPrice: 4083.66,
      amount: 4083.66,
    },
  ],
  totals: {
    bodyLaborPeriods: 3260,
    bodyLaborAmount: 31133,
    paintLaborPeriods: 1091,
    sumExVat: 249473.01,
    vatRate: 25,
    totalAmount: 311841,
    fixedPriceAgreement: 290000,
  },
};

describe('parseDbsEstimate', () => {
  it('parses a valid DBS payload and preserves periods verbatim', () => {
    const parsed = parseDbsEstimate(validPayload);
    expect(parsed.oppdragsId).toBe('26079539T2');
    expect(parsed.document.estimateNumber).toBe('EN64251');
    expect(parsed.operations[0]!.timePeriods).toBe(3260);
    expect(parsed.operations[0]!.side).toBe('H');
    // Money normalized to 2-dp strings.
    expect(parsed.parts[0]!.amount).toBe('4083.66');
    expect(parsed.totals!.bodyLaborPeriods).toBe(3260);
  });

  it('defaults missing arrays to empty', () => {
    const parsed = parseDbsEstimate({ document: {} });
    expect(parsed.operations).toEqual([]);
    expect(parsed.parts).toEqual([]);
    expect(parsed.totals).toBeNull();
  });

  it('throws DbsParseError on invalid payload', () => {
    expect(() =>
      parseDbsEstimate({
        document: { estimateNumber: 'x' },
        operations: [{ timePeriods: 5 }],
      }),
    ).toThrow(DbsParseError);
  });

  it('rejects a non-object payload', () => {
    expect(() => parseDbsEstimate(null)).toThrow(DbsParseError);
    expect(() => parseDbsEstimate('nope')).toThrow(DbsParseError);
  });
});
