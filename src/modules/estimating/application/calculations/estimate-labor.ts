/**
 * Estimate calculations (Single Source of Truth, CLAUDE.md § 4.5).
 *
 * The DBS estimate expresses labor time in PERIODS: 100 periods = 1 hour
 * (verified against real estimates, see docs/reference/dbs). These pure
 * functions are the ONE authoritative place that conversion and estimate
 * roll-ups live; dashboards, planning, invoicing, and the Dev panel all call
 * them. No inline `/100` arithmetic anywhere else.
 */

export const PERIODS_PER_HOUR = 100;

/** Convert DBS periods to hours. 100 periods = 1 hour. */
export function periodsToHours(periods: number): number {
  return periods / PERIODS_PER_HOUR;
}

/** Convert hours to DBS periods (rounded to the nearest whole period). */
export function hoursToPeriods(hours: number): number {
  return Math.round(hours * PERIODS_PER_HOUR);
}

export interface EstimateLaborTotals {
  bodyPeriods: number;
  paintPeriods: number;
  totalPeriods: number;
  totalHours: number;
}

/**
 * Sum labor periods across body operations and paint lines into the headline
 * labor totals the booking system schedules against.
 */
export function sumEstimateLabor(input: {
  operationPeriods: readonly number[];
  paintLaborPeriods: readonly number[];
}): EstimateLaborTotals {
  const bodyPeriods = input.operationPeriods.reduce((a, b) => a + b, 0);
  const paintPeriods = input.paintLaborPeriods.reduce((a, b) => a + b, 0);
  const totalPeriods = bodyPeriods + paintPeriods;
  return {
    bodyPeriods,
    paintPeriods,
    totalPeriods,
    totalHours: periodsToHours(totalPeriods),
  };
}
