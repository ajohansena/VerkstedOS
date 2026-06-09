/**
 * Rental availability calculation — SSoT (Sprint 18).
 *
 * Pure: given the rental vehicle, its existing reservations and a candidate
 * window, decide whether the vehicle can be reserved. Used by the booking
 * service and by the "rental availability calendar" UI projection.
 */

export interface RentalWindow {
  startsAt: Date;
  endsAt: Date;
}

export interface ReservationRow extends RentalWindow {
  id: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
}

export function hasConflict(
  candidate: RentalWindow,
  existing: readonly ReservationRow[],
): boolean {
  if (candidate.endsAt <= candidate.startsAt) return true;
  return existing.some((r) => {
    if (r.status === 'cancelled' || r.status === 'completed') return false;
    return r.startsAt < candidate.endsAt && r.endsAt > candidate.startsAt;
  });
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  reserved: boolean;
}

export function projectAvailability(
  rangeStart: Date,
  days: number,
  existing: readonly ReservationRow[],
): AvailabilityDay[] {
  const out: AvailabilityDay[] = [];
  const DAY = 86400000;
  for (let i = 0; i < days; i++) {
    const dayStart = new Date(rangeStart.getTime() + i * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const reserved = existing.some(
      (r) =>
        r.status !== 'cancelled' &&
        r.status !== 'completed' &&
        r.startsAt < dayEnd &&
        r.endsAt > dayStart,
    );
    out.push({ date: dayStart.toISOString().slice(0, 10), reserved });
  }
  return out;
}
