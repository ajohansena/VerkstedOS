import { describe, expect, it } from 'vitest';

import {
  PERIODS_PER_HOUR,
  hoursToPeriods,
  periodsToHours,
  sumEstimateLabor,
} from './estimate-labor';

describe('periods <-> hours (100 periods = 1 hour)', () => {
  it('PERIODS_PER_HOUR is 100', () => {
    expect(PERIODS_PER_HOUR).toBe(100);
  });

  it('converts periods to hours', () => {
    // Verified against EN64251: Karosseri Tid 3260 = 32.60 h.
    expect(periodsToHours(3260)).toBeCloseTo(32.6, 5);
    expect(periodsToHours(1091)).toBeCloseTo(10.91, 5);
    expect(periodsToHours(100)).toBe(1);
    expect(periodsToHours(0)).toBe(0);
  });

  it('converts hours to periods', () => {
    expect(hoursToPeriods(32.6)).toBe(3260);
    expect(hoursToPeriods(1)).toBe(100);
  });
});

describe('sumEstimateLabor', () => {
  it('sums body + paint periods into headline totals', () => {
    const result = sumEstimateLabor({
      operationPeriods: [3260, 100, 15],
      paintLaborPeriods: [1091],
    });
    expect(result.bodyPeriods).toBe(3375);
    expect(result.paintPeriods).toBe(1091);
    expect(result.totalPeriods).toBe(4466);
    expect(result.totalHours).toBeCloseTo(44.66, 5);
  });

  it('handles empty input', () => {
    const result = sumEstimateLabor({
      operationPeriods: [],
      paintLaborPeriods: [],
    });
    expect(result.totalPeriods).toBe(0);
    expect(result.totalHours).toBe(0);
  });
});
