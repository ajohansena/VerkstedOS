/**
 * Office-task calculations (SSoT, D3 Phase B).
 *
 * Office tasks are NEVER aggregated into case cost or billable totals
 * (CLAUDE.md § 4.7 — TakstKontroll compatibility). The summary functions here
 * are purely operational — "what's open, what's overdue" — and they explicitly
 * carry no money or hours.
 */

export interface OpenOfficeTaskRow {
  readonly id: string;
  readonly caseId: string | null;
  readonly priority: 'low' | 'normal' | 'high' | 'urgent';
  readonly status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  readonly dueAt: Date | null;
}

export interface OpenOfficeTaskSummary {
  readonly total: number;
  readonly open: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly nextDueAt: Date | null;
  readonly urgentCount: number;
}

/**
 * Summarize a set of office tasks for a single case (or any other grouping).
 * Pure function. Used by the case workspace timeline counter and the
 * `open_office_tasks_for_case` metric registry entry.
 *
 * Overdue = `status` in {open, in_progress} AND `dueAt` in the past. A task
 * with a null `dueAt` is never overdue.
 */
export function calculateOpenOfficeTaskSummary(
  tasks: ReadonlyArray<OpenOfficeTaskRow>,
  now: Date = new Date(),
): OpenOfficeTaskSummary {
  let open = 0;
  let inProgress = 0;
  let overdue = 0;
  let urgentCount = 0;
  let nextDueAt: Date | null = null;

  for (const t of tasks) {
    if (t.status !== 'open' && t.status !== 'in_progress') continue;
    if (t.status === 'open') open += 1;
    if (t.status === 'in_progress') inProgress += 1;
    if (t.priority === 'urgent') urgentCount += 1;
    if (t.dueAt) {
      if (t.dueAt.getTime() < now.getTime()) {
        overdue += 1;
      }
      if (!nextDueAt || t.dueAt.getTime() < nextDueAt.getTime()) {
        nextDueAt = t.dueAt;
      }
    }
  }

  return {
    total: open + inProgress,
    open,
    inProgress,
    overdue,
    nextDueAt,
    urgentCount,
  };
}
