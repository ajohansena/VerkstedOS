import { describe, expect, it } from 'vitest';

import { validateBookingDates } from './bookings';

/**
 * `validateBookingDates` — single invariant: promised delivery cannot precede
 * arrival. Anything else (nulls, only one side set) is allowed.
 */
describe('validateBookingDates', () => {
  it('returns no problems when both dates are null', () => {
    expect(
      validateBookingDates({ expectedArrivalAt: null, promisedDeliveryAt: null }),
    ).toEqual([]);
  });

  it('returns no problems when only arrival is set', () => {
    expect(
      validateBookingDates({
        expectedArrivalAt: new Date('2025-01-15T08:00:00Z'),
        promisedDeliveryAt: null,
      }),
    ).toEqual([]);
  });

  it('returns no problems when only delivery is set', () => {
    expect(
      validateBookingDates({
        expectedArrivalAt: null,
        promisedDeliveryAt: new Date('2025-01-20T16:00:00Z'),
      }),
    ).toEqual([]);
  });

  it('returns no problems when delivery is after arrival', () => {
    expect(
      validateBookingDates({
        expectedArrivalAt: new Date('2025-01-15T08:00:00Z'),
        promisedDeliveryAt: new Date('2025-01-15T16:00:00Z'),
      }),
    ).toEqual([]);
  });

  it('returns no problems when delivery exactly equals arrival', () => {
    const t = new Date('2025-01-15T12:00:00Z');
    expect(
      validateBookingDates({
        expectedArrivalAt: t,
        promisedDeliveryAt: new Date(t.getTime()),
      }),
    ).toEqual([]);
  });

  it('flags delivery-before-arrival', () => {
    const problems = validateBookingDates({
      expectedArrivalAt: new Date('2025-01-15T12:00:00Z'),
      promisedDeliveryAt: new Date('2025-01-15T08:00:00Z'),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/delivery|levering/i);
  });
});
