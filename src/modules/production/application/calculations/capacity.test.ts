import { describe, expect, it } from 'vitest';

import {
  absenceMinutesInDay,
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

describe('absenceMinutesInDay', () => {
  const dayStart = new Date('2026-06-22T07:00:00Z').getTime();
  const dayEnd = new Date('2026-06-22T15:00:00Z').getTime();

  it('returns 0 when no absences', () => {
    expect(absenceMinutesInDay(dayStart, dayEnd, [])).toBe(0);
  });

  it('returns 0 when range is degenerate', () => {
    expect(absenceMinutesInDay(dayStart, dayStart, [])).toBe(0);
  });

  it('counts a single fully-contained window', () => {
    const a = {
      startMs: new Date('2026-06-22T09:00:00Z').getTime(),
      endMs: new Date('2026-06-22T12:00:00Z').getTime(),
    };
    expect(absenceMinutesInDay(dayStart, dayEnd, [a])).toBe(180);
  });

  it('clips windows that extend past the day boundary', () => {
    const a = {
      startMs: new Date('2026-06-22T06:00:00Z').getTime(),
      endMs: new Date('2026-06-22T10:00:00Z').getTime(),
    };
    // overlap with 07:00–10:00 = 180 min
    expect(absenceMinutesInDay(dayStart, dayEnd, [a])).toBe(180);
  });

  it('merges overlapping windows', () => {
    const a = {
      startMs: new Date('2026-06-22T09:00:00Z').getTime(),
      endMs: new Date('2026-06-22T11:00:00Z').getTime(),
    };
    const b = {
      startMs: new Date('2026-06-22T10:00:00Z').getTime(),
      endMs: new Date('2026-06-22T13:00:00Z').getTime(),
    };
    // merged 09:00–13:00 = 240 min (not 120+180 = 300)
    expect(absenceMinutesInDay(dayStart, dayEnd, [a, b])).toBe(240);
  });

  it('sums disjoint windows', () => {
    const a = {
      startMs: new Date('2026-06-22T08:00:00Z').getTime(),
      endMs: new Date('2026-06-22T09:00:00Z').getTime(),
    };
    const b = {
      startMs: new Date('2026-06-22T13:00:00Z').getTime(),
      endMs: new Date('2026-06-22T14:00:00Z').getTime(),
    };
    expect(absenceMinutesInDay(dayStart, dayEnd, [a, b])).toBe(120);
  });

  it('returns 0 when the absence is entirely outside the day', () => {
    const a = {
      startMs: new Date('2026-06-21T08:00:00Z').getTime(),
      endMs: new Date('2026-06-22T06:00:00Z').getTime(),
    };
    expect(absenceMinutesInDay(dayStart, dayEnd, [a])).toBe(0);
  });
});
