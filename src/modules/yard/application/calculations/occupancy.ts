/**
 * Yard occupancy & utilization (SSoT) — Sprint 19.
 *
 * Pure helpers that compute the human-meaningful occupancy answers for a
 * yard map (how full is this location? this layout? this workshop?).
 * Used by `/yard` (mobile + tablet), the admin layout designer, and any
 * future cross-workshop occupancy report — so there is exactly one
 * implementation everywhere.
 */

export interface OccupancyLine {
  /** Capacity of this slot (almost always 1; storage rows may be higher). */
  capacity: number;
  /** Active (non-departed) placements currently on the slot. */
  occupied: number;
}

export interface OccupancySummary {
  capacity: number;
  occupied: number;
  /** Fraction in [0, ∞); >1 means over-capacity (data error / forced placement). */
  utilization: number;
  /** Free slots clamped at 0 (a packed-tight row reports 0, never negative). */
  free: number;
}

/** Aggregate any number of slots into a single summary. Pure. */
export function summarizeOccupancy(
  lines: readonly OccupancyLine[],
): OccupancySummary {
  let capacity = 0;
  let occupied = 0;
  for (const line of lines) {
    capacity += line.capacity;
    occupied += line.occupied;
  }
  const utilization = capacity === 0 ? 0 : occupied / capacity;
  const free = Math.max(0, capacity - occupied);
  return { capacity, occupied, utilization, free };
}

/** Status a single slot SHOULD have given its capacity and active placements,
 *  used by the move service to keep `yard_locations.status` in sync with
 *  reality. Pure: does not query, does not write. */
export function deriveLocationStatus(
  line: OccupancyLine,
  /** A "blocked" slot stays blocked even when empty — explicit admin decision. */
  isBlocked: boolean,
  /** A "reserved" slot stays reserved while empty — explicit reservation. */
  isReserved: boolean,
): 'available' | 'occupied' | 'reserved' | 'blocked' {
  if (isBlocked) return 'blocked';
  if (line.occupied >= line.capacity && line.capacity > 0) return 'occupied';
  if (isReserved) return 'reserved';
  return 'available';
}
