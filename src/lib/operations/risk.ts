/**
 * Operations risk helpers — pure, server-free (no DB imports).
 *
 * Extracted so client components (the Production Board v2 card) can import the
 * canonical risk classification WITHOUT pulling the server-only snapshot
 * composer (and its DB client) into the browser bundle.
 *
 * `classifyCaseRisk` is the registered SSoT `case_risk` metric (CLAUDE.md
 * § 4.5).
 */

/**
 * Normal cycle baseline (12 days) — matches the DBS estimate's
 * `normalReparasjonstid`. Org-specific overrides will be wired through the
 * snapshot composer from `organizations.settings`.
 */
export const NORMAL_REPAIR_DAYS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days the case has been open (floored so day-0 reads as `0`). */
export function caseAgeDays(openedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - openedAt.getTime()) / DAY_MS));
}

/**
 * Per-case risk classification — used by board cards and the Pulse `atRisk`
 * counter. Pure; tested in unit tests.
 */
export function classifyCaseRisk(input: {
  readonly openedAt: Date;
  readonly onHold: boolean;
  readonly openPartsCount: number;
  readonly stateCategory: 'active' | 'waiting' | 'terminal' | null;
  readonly now?: Date;
}): 'green' | 'yellow' | 'red' {
  const now = input.now ?? new Date();
  const age = caseAgeDays(input.openedAt, now);
  if (input.stateCategory === 'terminal') return 'green';
  if (age >= NORMAL_REPAIR_DAYS) return 'red';
  if (input.onHold) return 'red';
  if (age >= Math.floor(NORMAL_REPAIR_DAYS * 0.75)) return 'yellow';
  if (input.openPartsCount > 0 && input.stateCategory === 'waiting') {
    return 'yellow';
  }
  return 'green';
}
