import { describe, expect, it } from 'vitest';

import {
  calculateOpenOfficeTaskSummary,
  type OpenOfficeTaskRow,
} from './office-tasks';

function row(partial: Partial<OpenOfficeTaskRow>): OpenOfficeTaskRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    caseId: partial.caseId ?? null,
    priority: partial.priority ?? 'normal',
    status: partial.status ?? 'open',
    dueAt: partial.dueAt ?? null,
  };
}

const NOW = new Date('2025-06-01T10:00:00Z');
const YESTERDAY = new Date('2025-05-31T10:00:00Z');
const TOMORROW = new Date('2025-06-02T10:00:00Z');
const NEXT_WEEK = new Date('2025-06-08T10:00:00Z');

describe('calculateOpenOfficeTaskSummary', () => {
  it('returns all zeros on empty input', () => {
    const summary = calculateOpenOfficeTaskSummary([], NOW);
    expect(summary).toEqual({
      total: 0,
      open: 0,
      inProgress: 0,
      overdue: 0,
      nextDueAt: null,
      urgentCount: 0,
    });
  });

  it('counts open and in_progress, skips completed and cancelled', () => {
    const summary = calculateOpenOfficeTaskSummary(
      [
        row({ status: 'open' }),
        row({ status: 'open' }),
        row({ status: 'in_progress' }),
        row({ status: 'completed' }),
        row({ status: 'cancelled' }),
      ],
      NOW,
    );
    expect(summary.total).toBe(3);
    expect(summary.open).toBe(2);
    expect(summary.inProgress).toBe(1);
  });

  it('flags overdue only for active tasks whose due_at is past', () => {
    const summary = calculateOpenOfficeTaskSummary(
      [
        row({ status: 'open', dueAt: YESTERDAY }),
        row({ status: 'in_progress', dueAt: YESTERDAY }),
        row({ status: 'open', dueAt: TOMORROW }),
        row({ status: 'completed', dueAt: YESTERDAY }), // completed past = NOT overdue
      ],
      NOW,
    );
    expect(summary.overdue).toBe(2);
  });

  it('returns earliest dueAt among active tasks as nextDueAt', () => {
    const summary = calculateOpenOfficeTaskSummary(
      [
        row({ status: 'open', dueAt: NEXT_WEEK }),
        row({ status: 'open', dueAt: TOMORROW }),
        row({ status: 'in_progress', dueAt: YESTERDAY }),
        row({ status: 'completed', dueAt: new Date('2024-01-01T00:00:00Z') }),
      ],
      NOW,
    );
    expect(summary.nextDueAt).toEqual(YESTERDAY);
  });

  it('null dueAt is never overdue and never sets nextDueAt', () => {
    const summary = calculateOpenOfficeTaskSummary(
      [
        row({ status: 'open', dueAt: null }),
        row({ status: 'open', dueAt: null }),
      ],
      NOW,
    );
    expect(summary.overdue).toBe(0);
    expect(summary.nextDueAt).toBeNull();
    expect(summary.total).toBe(2);
  });

  it('counts only active urgent tasks as urgentCount', () => {
    const summary = calculateOpenOfficeTaskSummary(
      [
        row({ status: 'open', priority: 'urgent' }),
        row({ status: 'in_progress', priority: 'urgent' }),
        row({ status: 'completed', priority: 'urgent' }), // ignored
        row({ status: 'open', priority: 'high' }), // not urgent
      ],
      NOW,
    );
    expect(summary.urgentCount).toBe(2);
  });
});
