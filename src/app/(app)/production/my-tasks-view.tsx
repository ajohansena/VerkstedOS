import Link from 'next/link';

import type { getDictionary } from '@/lib/i18n';

export type MyTasksRow = {
  segmentId: string;
  segmentLabel: string | null;
  caseId: string;
  caseNumber: string;
  resourceName: string;
  plannedStartAt: Date;
  plannedEndAt: Date | null;
};

export type MyOfficeTaskRow = {
  taskId: string;
  title: string;
  kind: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  caseId: string | null;
  caseNumber: string | null;
  dueAt: Date | null;
};

interface Props {
  todays: MyTasksRow[];
  rest: MyTasksRow[];
  officeTasksToday: MyOfficeTaskRow[];
  officeTasksLater: MyOfficeTaskRow[];
  hasResources: boolean;
  t: ReturnType<typeof getDictionary>;
}

/**
 * Production Board v3 — My Tasks View (Sprint 20 + D3 Phase E, doc 13 §4.5).
 * Shows segments planned for the current user's resources + office tasks
 * directly assigned to the user or their resources. Empty state when the user
 * has neither resources nor office tasks.
 */
export function MyTasksView({
  todays,
  rest,
  officeTasksToday,
  officeTasksLater,
  hasResources,
  t,
}: Props) {
  const fmtTime = (d: Date | null): string =>
    d
      ? new Intl.DateTimeFormat('nb-NO', { timeStyle: 'short' }).format(d)
      : '—';

  const fmtRange = (s: Date, e: Date | null): string =>
    `${fmtTime(s)}–${fmtTime(e)}`;

  const hasAnything =
    todays.length > 0 ||
    rest.length > 0 ||
    officeTasksToday.length > 0 ||
    officeTasksLater.length > 0;

  if (!hasResources && !hasAnything) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {t.myTasks.notAssigned}
      </section>
    );
  }

  if (!hasAnything) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {t.myTasks.empty}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {officeTasksToday.length > 0 && (
        <OfficeTaskList
          heading={t.officeTask.title + ' · ' + t.common.today}
          rows={officeTasksToday}
          t={t}
        />
      )}
      {todays.length > 0 && (
        <TaskTable
          heading={t.myTasks.plannedTodayHeading}
          rows={todays}
          t={t}
          fmtRange={fmtRange}
        />
      )}
      {officeTasksLater.length > 0 && (
        <OfficeTaskList
          heading={t.officeTask.title}
          rows={officeTasksLater}
          t={t}
          showDate
        />
      )}
      {rest.length > 0 && (
        <TaskTable
          heading={t.myTasks.plannedThisWeekHeading}
          rows={rest}
          t={t}
          fmtRange={fmtRange}
          showDate
        />
      )}
    </div>
  );
}

function OfficeTaskList({
  heading,
  rows,
  t,
  showDate,
}: {
  heading: string;
  rows: MyOfficeTaskRow[];
  t: ReturnType<typeof getDictionary>;
  showDate?: boolean;
}) {
  const now = Date.now();
  const fmtDate = (d: Date | null): string =>
    d
      ? new Intl.DateTimeFormat('nb-NO', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d)
      : t.officeTask.noDueAt;
  const fmtTime = (d: Date | null): string =>
    d
      ? new Intl.DateTimeFormat('nb-NO', { timeStyle: 'short' }).format(d)
      : t.officeTask.noDueAt;
  return (
    <section className="rounded-lg border bg-background">
      <header className="border-b p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </h2>
      </header>
      <ul className="divide-y text-sm">
        {rows.map((r) => {
          const overdue = r.dueAt !== null && r.dueAt.getTime() < now;
          return (
            <li key={r.taskId} className="flex items-center gap-3 p-3">
              <span
                className={
                  'min-w-24 text-xs tabular-nums ' +
                  (overdue
                    ? 'font-medium text-red-600'
                    : 'text-muted-foreground')
                }
              >
                {showDate ? fmtDate(r.dueAt) : fmtTime(r.dueAt)}
              </span>
              <span className="flex-1">
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.kind}
                </span>
              </span>
              {r.caseId && r.caseNumber ? (
                <Link href={`/cases/${r.caseId}`} className="text-xs underline">
                  {r.caseNumber}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TaskTable({
  heading,
  rows,
  t,
  fmtRange,
  showDate,
}: {
  heading: string;
  rows: MyTasksRow[];
  t: ReturnType<typeof getDictionary>;
  fmtRange: (s: Date, e: Date | null) => string;
  showDate?: boolean;
}) {
  const fmtDate = (d: Date): string =>
    new Intl.DateTimeFormat('nb-NO', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(d);

  return (
    <section className="rounded-lg border bg-background">
      <header className="border-b p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </h2>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="p-3 text-left">{t.myTasks.columnTime}</th>
            <th className="p-3 text-left">{t.myTasks.columnCase}</th>
            <th className="p-3 text-left">{t.myTasks.columnTitle}</th>
            <th className="p-3 text-left">{t.myTasks.columnResource}</th>
            <th className="p-3 text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.segmentId} className="border-b last:border-b-0">
              <td className="p-3 tabular-nums">
                {showDate && (
                  <span className="mr-2 text-xs text-muted-foreground">
                    {fmtDate(r.plannedStartAt)}
                  </span>
                )}
                {fmtRange(r.plannedStartAt, r.plannedEndAt)}
              </td>
              <td className="p-3 font-medium">{r.caseNumber}</td>
              <td className="p-3">{r.segmentLabel ?? '—'}</td>
              <td className="p-3 text-muted-foreground">{r.resourceName}</td>
              <td className="p-3 text-right">
                <Link href={`/cases/${r.caseId}`} className="text-xs underline">
                  {t.myTasks.openCase}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
