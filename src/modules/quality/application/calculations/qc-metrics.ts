/**
 * Quality-control calculations (Single Source of Truth, CLAUDE.md § 4.5,
 * docs/10-production-domain.md). Pure functions — the ONE place QC and rework
 * KPIs are computed. Dashboards, reports, and the Dev surface all call these.
 *
 * Rework is kept SEPARABLE from insurance/customer work (TakstKontroll, § 4.7):
 * the rework rate is driven by deviations linked to the `internal_rework`
 * funding source, never blended into other cost metrics.
 */

export interface ChecklistRunOutcome {
  status: 'in_progress' | 'passed' | 'failed' | 'cancelled';
}

export interface QcFailureRateResult {
  totalCompleted: number;
  failed: number;
  /** 0..1 — failed completed runs over all completed runs. */
  rate: number;
}

/**
 * QC failure rate over a set of checklist runs. Only completed runs
 * (passed/failed) count toward the denominator; in-progress and cancelled are
 * excluded.
 */
export function calculateQcFailureRate(
  runs: readonly ChecklistRunOutcome[],
): QcFailureRateResult {
  const completed = runs.filter(
    (r) => r.status === 'passed' || r.status === 'failed',
  );
  const failed = completed.filter((r) => r.status === 'failed').length;
  const rate = completed.length > 0 ? failed / completed.length : 0;
  return { totalCompleted: completed.length, failed, rate };
}

export interface ReworkRateInput {
  /** Total cases in the period. */
  totalCases: number;
  /** Cases that incurred internal rework (≥1 internal_rework deviation). */
  reworkCases: number;
}

export interface ReworkRateResult {
  totalCases: number;
  reworkCases: number;
  /** 0..1 — share of cases that needed rework. */
  rate: number;
}

/** Rework rate = cases with internal rework / total cases. */
export function calculateReworkRate(input: ReworkRateInput): ReworkRateResult {
  const rate = input.totalCases > 0 ? input.reworkCases / input.totalCases : 0;
  return {
    totalCases: input.totalCases,
    reworkCases: input.reworkCases,
    rate,
  };
}
