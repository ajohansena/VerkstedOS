import { describe, expect, it } from 'vitest';

import { deriveLocationStatus, summarizeOccupancy } from './occupancy';

describe('summarizeOccupancy', () => {
  it('returns zero utilization for an empty layout', () => {
    const summary = summarizeOccupancy([]);
    expect(summary).toEqual({ capacity: 0, occupied: 0, utilization: 0, free: 0 });
  });

  it('aggregates capacity and occupancy across lines', () => {
    const summary = summarizeOccupancy([
      { capacity: 1, occupied: 1 },
      { capacity: 1, occupied: 0 },
      { capacity: 4, occupied: 2 },
    ]);
    expect(summary.capacity).toBe(6);
    expect(summary.occupied).toBe(3);
    expect(summary.utilization).toBeCloseTo(0.5);
    expect(summary.free).toBe(3);
  });

  it('clamps free to zero on over-capacity (data error / forced placement)', () => {
    const summary = summarizeOccupancy([{ capacity: 2, occupied: 3 }]);
    expect(summary.free).toBe(0);
    expect(summary.utilization).toBeCloseTo(1.5);
  });
});

describe('deriveLocationStatus', () => {
  it('blocked wins over everything', () => {
    expect(
      deriveLocationStatus({ capacity: 1, occupied: 0 }, true, false),
    ).toBe('blocked');
    expect(
      deriveLocationStatus({ capacity: 1, occupied: 1 }, true, true),
    ).toBe('blocked');
  });

  it('occupied wins over reserved when capacity is filled', () => {
    expect(
      deriveLocationStatus({ capacity: 1, occupied: 1 }, false, true),
    ).toBe('occupied');
  });

  it('reserved when empty but reserved flag set', () => {
    expect(
      deriveLocationStatus({ capacity: 1, occupied: 0 }, false, true),
    ).toBe('reserved');
  });

  it('available when empty and not reserved/blocked', () => {
    expect(
      deriveLocationStatus({ capacity: 1, occupied: 0 }, false, false),
    ).toBe('available');
  });

  it('zero-capacity slot never becomes "occupied"', () => {
    expect(
      deriveLocationStatus({ capacity: 0, occupied: 0 }, false, false),
    ).toBe('available');
  });
});
