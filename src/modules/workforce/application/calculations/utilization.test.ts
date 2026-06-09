import { describe, expect, it } from 'vitest';

import { calculateUtilization } from './utilization';

describe('calculateUtilization', () => {
  it('computes booked / available', () => {
    const r = calculateUtilization({
      bookedMinutes: 300,
      availableMinutes: 600,
    });
    expect(r.rate).toBe(0.5);
    expect(r.percent).toBe(50);
  });

  it('clamps overbooking to 100%', () => {
    const r = calculateUtilization({
      bookedMinutes: 800,
      availableMinutes: 600,
    });
    expect(r.rate).toBe(1);
    expect(r.percent).toBe(100);
  });

  it('is zero when there is no capacity', () => {
    const r = calculateUtilization({ bookedMinutes: 100, availableMinutes: 0 });
    expect(r.rate).toBe(0);
    expect(r.percent).toBe(0);
  });

  it('floors negative inputs at zero', () => {
    const r = calculateUtilization({
      bookedMinutes: -50,
      availableMinutes: 600,
    });
    expect(r.bookedMinutes).toBe(0);
    expect(r.rate).toBe(0);
  });
});
