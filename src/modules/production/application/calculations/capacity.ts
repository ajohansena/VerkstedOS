/**
 * Production capacity & remaining-work calculations (Single Source of Truth,
 * CLAUDE.md § 4.5, docs/10-production-domain.md § Capacity engine).
 *
 * Pure functions. The ONE authoritative place capacity is computed — dashboards,
 * the planner, simulation, and the Dev recompute tool all call these. No inline
 * capacity arithmetic anywhere else.
 *
 * All durations are MINUTES. Per the periods rule, planned minutes derive from
 * estimate periods via the estimating SSoT (`periodsToHours` × 60) before
 * reaching here.
 */

export interface ResourceDayLoad {
  totalMinutes: number;
  committedMinutes: number;
}

export interface CapacityResult {
  totalMinutes: number;
  committedMinutes: number;
  availableMinutes: number;
  utilization: number; // 0..1+ (can exceed 1 when overbooked)
}

/** Available = total − committed; utilization = committed / total. */
export function computeCapacity(load: ResourceDayLoad): CapacityResult {
  const availableMinutes = load.totalMinutes - load.committedMinutes;
  const utilization =
    load.totalMinutes > 0 ? load.committedMinutes / load.totalMinutes : 0;
  return {
    totalMinutes: load.totalMinutes,
    committedMinutes: load.committedMinutes,
    availableMinutes,
    utilization,
  };
}

/** Remaining minutes on a segment = max(0, planned − actual). */
export function segmentRemainingMinutes(input: {
  plannedMinutes: number;
  actualMinutes: number;
}): number {
  return Math.max(0, input.plannedMinutes - input.actualMinutes);
}

/** Sum of remaining minutes across open segments. */
export function remainingWorkMinutes(
  segments: readonly {
    plannedMinutes: number;
    actualMinutes: number;
    status: string;
  }[],
): number {
  return segments
    .filter((s) => s.status !== 'completed' && s.status !== 'cancelled')
    .reduce((sum, s) => sum + segmentRemainingMinutes(s), 0);
}

export type Feasibility = 'comfortable' | 'tight' | 'overbooked';

/**
 * Classify the impact of adding `additionalMinutes` to a resource-day with the
 * given current load. Used by "simulate accepting this case".
 *   - overbooked: committed + additional > total
 *   - tight:      utilization after add ≥ 0.85
 *   - comfortable otherwise
 */
export function classifyFeasibility(
  load: ResourceDayLoad,
  additionalMinutes: number,
): Feasibility {
  const after = load.committedMinutes + additionalMinutes;
  if (load.totalMinutes > 0 && after > load.totalMinutes) return 'overbooked';
  const utilization = load.totalMinutes > 0 ? after / load.totalMinutes : 0;
  if (utilization >= 0.85) return 'tight';
  return 'comfortable';
}

// --- Absence integration (Sprint 18) ----------------------------------------

export interface AbsenceWindow {
  /** Inclusive UTC ms. */
  startMs: number;
  /** Exclusive UTC ms. */
  endMs: number;
}

/**
 * Compute the minutes a resource is absent during the given day window.
 * Pure: the caller fetches `approved` absence entries and converts them to
 * `{startMs,endMs}` windows. Overlapping windows are merged so two absences
 * on the same day never double-count.
 *
 * Used by the capacity engine to derive `totalMinutes` for the day:
 *   `effectiveTotal = baseTotalMinutes - absenceMinutesInDay(...)`
 *
 * Single Source of Truth — no other call site is allowed to subtract
 * absence minutes by hand.
 */
export function absenceMinutesInDay(
  dayStartMs: number,
  dayEndMs: number,
  absences: readonly AbsenceWindow[],
): number {
  if (absences.length === 0 || dayEndMs <= dayStartMs) return 0;
  const clipped: AbsenceWindow[] = [];
  for (const a of absences) {
    const start = Math.max(a.startMs, dayStartMs);
    const end = Math.min(a.endMs, dayEndMs);
    if (end > start) clipped.push({ startMs: start, endMs: end });
  }
  if (clipped.length === 0) return 0;
  clipped.sort((x, y) => x.startMs - y.startMs);
  let totalMs = 0;
  let curStart = clipped[0]!.startMs;
  let curEnd = clipped[0]!.endMs;
  for (let i = 1; i < clipped.length; i++) {
    const w = clipped[i]!;
    if (w.startMs <= curEnd) {
      curEnd = Math.max(curEnd, w.endMs);
    } else {
      totalMs += curEnd - curStart;
      curStart = w.startMs;
      curEnd = w.endMs;
    }
  }
  totalMs += curEnd - curStart;
  return Math.floor(totalMs / 60000);
}
