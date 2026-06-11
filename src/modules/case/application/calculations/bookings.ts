/**
 * Booking-domain pure calculations (Single Source of Truth — CLAUDE.md § 4.5).
 *
 * Validation rules for case bookings. No I/O, no DB. Used by both the wizard
 * client component (preview) and the booking service (authoritative).
 */

export interface BookingDates {
  expectedArrivalAt?: Date | null;
  promisedDeliveryAt?: Date | null;
}

/**
 * Validate booking date relationships. Returns human-readable problems; empty
 * array = valid. Each rule is intentionally narrow so the wizard can map a
 * problem to the offending field.
 *
 *   - delivery cannot precede arrival
 *   - either date may stand alone (tentative bookings often start with just
 *     a promised delivery, or just an arrival)
 *   - dates in the past are allowed (operator may book "yesterday" to record
 *     a walk-in retrospectively — audit captures who/when)
 */
export function validateBookingDates(input: BookingDates): string[] {
  const problems: string[] = [];
  if (
    input.expectedArrivalAt &&
    input.promisedDeliveryAt &&
    input.promisedDeliveryAt < input.expectedArrivalAt
  ) {
    problems.push('Lovet levering kan ikke være før forventet ankomst.');
  }
  return problems;
}
