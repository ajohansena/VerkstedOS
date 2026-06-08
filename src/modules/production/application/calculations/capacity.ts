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
