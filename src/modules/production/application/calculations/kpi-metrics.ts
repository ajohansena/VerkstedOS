/**
 * Production KPI calculations — Single Source of Truth (CLAUDE.md § 4.5).
 *
 * Pure functions. The ONE authoritative place throughput, cycle time, and
 * on-time delivery are computed. Dashboards (Production Manager, Workshop Owner,
 * Executive), the nightly KPI snapshot job, and the Dev KPI-drift inspector all
 * call these — there is no second implementation.
 *
 * Registered metrics: `kpi_throughput`, `kpi_cycle_time`, `kpi_on_time_rate`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DeliveredCase {
  /** When the case was opened (intake). */
  readonly openedAt: Date;
  /** When the case was delivered, or null if still open. */
  readonly deliveredAt: Date | null;
  /**
   * The promised delivery date for the case. Until a first-class promised date
   * exists, callers pass `openedAt + normalRepairDays` (the DBS normal cycle).
   */
  readonly promisedAt: Date | null;
}

/**
 * Throughput — the number of cases delivered within the window. A plain count
 * of cases whose `deliveredAt` falls in `[from, to]`.
 */
export function calculateThroughput(
  cases: ReadonlyArray<DeliveredCase>,
  from: Date,
  to: Date,
): number {
  let n = 0;
  for (const c of cases) {
    if (
      c.deliveredAt &&
      c.deliveredAt.getTime() >= from.getTime() &&
      c.deliveredAt.getTime() <= to.getTime()
    ) {
      n += 1;
    }
  }
  return n;
}

export interface CycleTimeResult {
  /** Cases that contributed (delivered, with a known open date). */
  readonly sampleSize: number;
  /** Mean open→delivered duration in days, rounded to 1 decimal. */
  readonly averageDays: number;
}

/**
 * Average cycle time — mean open→delivered duration (in days) over the
 * delivered cases supplied. Returns 0 days for an empty sample (callers show
 * "—" when `sampleSize` is 0).
 */
export function calculateAverageCycleTime(
  cases: ReadonlyArray<DeliveredCase>,
): CycleTimeResult {
  let total = 0;
  let n = 0;
  for (const c of cases) {
    if (c.deliveredAt) {
      total += (c.deliveredAt.getTime() - c.openedAt.getTime()) / DAY_MS;
      n += 1;
    }
  }
  if (n === 0) return { sampleSize: 0, averageDays: 0 };
  return { sampleSize: n, averageDays: Math.round((total / n) * 10) / 10 };
}

export interface OnTimeResult {
  readonly delivered: number;
  readonly onTime: number;
  /** On-time fraction in [0, 1]; 0 when nothing delivered. */
  readonly rate: number;
}

/**
 * On-time delivery rate — the fraction of delivered cases whose `deliveredAt`
 * was on or before the `promisedAt`. Cases without a promised date are counted
 * in the denominator but never as on-time (conservative — an unpromised case
 * that slipped should not flatter the metric).
 */
export function calculateOnTimeDeliveryRate(
  cases: ReadonlyArray<DeliveredCase>,
): OnTimeResult {
  let delivered = 0;
  let onTime = 0;
  for (const c of cases) {
    if (!c.deliveredAt) continue;
    delivered += 1;
    if (c.promisedAt && c.deliveredAt.getTime() <= c.promisedAt.getTime()) {
      onTime += 1;
    }
  }
  const rate = delivered === 0 ? 0 : onTime / delivered;
  return { delivered, onTime, rate };
}
