import { describe, expect, it } from 'vitest';

import { calculateQcFailureRate, calculateReworkRate } from './qc-metrics';

describe('qc-metrics', () => {
  it('QC failure rate counts only completed runs', () => {
    const r = calculateQcFailureRate([
      { status: 'passed' },
      { status: 'failed' },
      { status: 'passed' },
      { status: 'in_progress' }, // excluded
      { status: 'cancelled' }, // excluded
    ]);
    expect(r.totalCompleted).toBe(3);
    expect(r.failed).toBe(1);
    expect(r.rate).toBeCloseTo(1 / 3);
  });

  it('QC failure rate is 0 when no completed runs', () => {
    const r = calculateQcFailureRate([{ status: 'in_progress' }]);
    expect(r.totalCompleted).toBe(0);
    expect(r.rate).toBe(0);
  });

  it('rework rate = rework cases / total cases', () => {
    const r = calculateReworkRate({ totalCases: 20, reworkCases: 3 });
    expect(r.rate).toBeCloseTo(0.15);
  });

  it('rework rate is 0 when there are no cases', () => {
    expect(calculateReworkRate({ totalCases: 0, reworkCases: 0 }).rate).toBe(0);
  });
});
