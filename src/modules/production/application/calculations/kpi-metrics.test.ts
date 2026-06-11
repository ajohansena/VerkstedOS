import { describe, expect, it } from 'vitest';

import {
  calculateAverageCycleTime,
  calculateOnTimeDeliveryRate,
  calculateThroughput,
  type DeliveredCase,
} from './kpi-metrics';

const DAY = 24 * 60 * 60 * 1000;
const base = new Date('2026-01-01T00:00:00Z');

function dcase(
  openDay: number,
  deliverDay: number | null,
  promiseDay: number | null,
): DeliveredCase {
  return {
    openedAt: new Date(base.getTime() + openDay * DAY),
    deliveredAt:
      deliverDay === null ? null : new Date(base.getTime() + deliverDay * DAY),
    promisedAt:
      promiseDay === null ? null : new Date(base.getTime() + promiseDay * DAY),
  };
}

describe('calculateThroughput', () => {
  const from = new Date(base.getTime());
  const to = new Date(base.getTime() + 30 * DAY);

  it('counts cases delivered within the window', () => {
    const cases = [dcase(0, 5, 12), dcase(0, 29, 12), dcase(0, null, 12)];
    expect(calculateThroughput(cases, from, to)).toBe(2);
  });

  it('excludes deliveries outside the window', () => {
    const cases = [dcase(0, 40, 12), dcase(0, -1, 12)];
    expect(calculateThroughput(cases, from, to)).toBe(0);
  });

  it('is zero for an empty set', () => {
    expect(calculateThroughput([], from, to)).toBe(0);
  });
});

describe('calculateAverageCycleTime', () => {
  it('averages open→delivered duration in days', () => {
    const r = calculateAverageCycleTime([dcase(0, 10, 12), dcase(0, 20, 12)]);
    expect(r.sampleSize).toBe(2);
    expect(r.averageDays).toBe(15);
  });

  it('ignores undelivered cases', () => {
    const r = calculateAverageCycleTime([dcase(0, 10, 12), dcase(0, null, 12)]);
    expect(r.sampleSize).toBe(1);
    expect(r.averageDays).toBe(10);
  });

  it('returns 0 with no sample', () => {
    const r = calculateAverageCycleTime([dcase(0, null, 12)]);
    expect(r).toEqual({ sampleSize: 0, averageDays: 0 });
  });
});

describe('calculateOnTimeDeliveryRate', () => {
  it('counts delivered on/before the promised date as on-time', () => {
    const r = calculateOnTimeDeliveryRate([
      dcase(0, 10, 12), // on time
      dcase(0, 15, 12), // late
      dcase(0, 12, 12), // exactly on time
    ]);
    expect(r.delivered).toBe(3);
    expect(r.onTime).toBe(2);
    expect(r.rate).toBeCloseTo(2 / 3, 5);
  });

  it('never counts an unpromised case as on-time', () => {
    const r = calculateOnTimeDeliveryRate([dcase(0, 10, null)]);
    expect(r.delivered).toBe(1);
    expect(r.onTime).toBe(0);
    expect(r.rate).toBe(0);
  });

  it('is zero when nothing is delivered', () => {
    const r = calculateOnTimeDeliveryRate([dcase(0, null, 12)]);
    expect(r).toEqual({ delivered: 0, onTime: 0, rate: 0 });
  });
});
