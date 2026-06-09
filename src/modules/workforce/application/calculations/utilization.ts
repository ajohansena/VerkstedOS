/**
 * Workforce KPI calculations — Single Source of Truth (CLAUDE.md § 4.5).
 *
 * Pure functions. The authoritative place workforce utilization is computed.
 * Dashboards and the nightly KPI snapshot job call this — no second
 * implementation. Registered metric: `kpi_utilization`.
 */

export interface UtilizationInput {
  /** Minutes booked to work segments (planned or actual) in the window. */
  readonly bookedMinutes: number;
  /** Minutes available (shift capacity) in the window. */
  readonly availableMinutes: number;
}

export interface UtilizationResult {
  readonly bookedMinutes: number;
  readonly availableMinutes: number;
  /** Booked / available, clamped to [0, 1]; 0 when no capacity. */
  readonly rate: number;
  /** Whole-percent convenience value. */
  readonly percent: number;
}

/**
 * Utilization — the fraction of available capacity that is booked. Clamped to
 * [0, 1] so an overbooked window reads as 100% rather than >100% (overbooking
 * is surfaced separately as a planning conflict, not as a utilization figure).
 */
export function calculateUtilization(
  input: UtilizationInput,
): UtilizationResult {
  const available = Math.max(0, input.availableMinutes);
  const booked = Math.max(0, input.bookedMinutes);
  const raw = available === 0 ? 0 : booked / available;
  const rate = Math.min(1, raw);
  return {
    bookedMinutes: booked,
    availableMinutes: available,
    rate,
    percent: Math.round(rate * 100),
  };
}
