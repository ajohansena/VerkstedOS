import { describe, expect, it } from 'vitest';

import {
  classifyFeasibility,
  computeCapacity,
  remainingWorkMinutes,
  segmentRemainingMinutes,
} from './capacity';

describe('computeCapacity', () => {
  it('computes available + utilization', () => {
    const r = computeCapacity({ totalMinutes: 480, committedMinutes: 360 });
    expect(r.availableMinutes).toBe(120);
    expect(r.utilization).toBeCloseTo(0.75, 5);
  });

  it('handles zero total', () => {
    const r = computeCapacity({ totalMinutes: 0, committedMinutes: 0 });
    expect(r.utilization).toBe(0);
  });

  it('reports overbooked utilization > 1', () => {
    const r = computeCapacity({ totalMinutes: 480, committedMinutes: 540 });
    expect(r.availableMinutes).toBe(-60);
    expect(r.utilization).toBeGreaterThan(1);
  });
});

describe('segmentRemainingMinutes', () => {
  it('clamps at zero', () => {
    expect(
      segmentRemainingMinutes({ plannedMinutes: 120, actualMinutes: 90 }),
    ).toBe(30);
    expect(
      segmentRemainingMinutes({ plannedMinutes: 120, actualMinutes: 200 }),
    ).toBe(0);
  });
});

describe('remainingWorkMinutes', () => {
  it('sums open segments only', () => {
    const total = remainingWorkMinutes([
      { plannedMinutes: 120, actualMinutes: 30, status: 'in_progress' },
      { plannedMinutes: 60, actualMinutes: 0, status: 'not_started' },
      { plannedMinutes: 90, actualMinutes: 90, status: 'completed' },
      { plannedMinutes: 45, actualMinutes: 0, status: 'cancelled' },
    ]);
    expect(total).toBe(90 + 60); // completed + cancelled excluded
  });
});

describe('classifyFeasibility', () => {
  const load = { totalMinutes: 480, committedMinutes: 300 };
  it('comfortable when well under', () => {
    expect(classifyFeasibility(load, 60)).toBe('comfortable');
  });
  it('tight near capacity', () => {
    expect(classifyFeasibility(load, 120)).toBe('tight'); // 420/480 = 0.875
  });
  it('overbooked when exceeding total', () => {
    expect(classifyFeasibility(load, 240)).toBe('overbooked'); // 540 > 480
  });
});
