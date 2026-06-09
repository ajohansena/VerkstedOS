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

interface Props {
  todays: MyTasksRow[];
  rest: MyTasksRow[];
  hasResources: boolean;
  t: ReturnType<typeof getDictionary>;
}

/**
 * Production Board v3 — My Tasks View (Sprint 20, doc 13 §4.5). Shows the
 * segments planned for the current user's resources (assignments where the
 * resource is linked to their employee record). Two buckets: today + rest of
 * the week. Empty state when the user has no linked resources.
 */
export function MyTasksView({ todays, rest, hasResources, t }: Props) {
  const fmtTime = (d: Date | null): string =>
    d ? new Intl.DateTimeFormat('nb-NO', { timeStyle: 'short' }).format(d) : '—';

  const fmtRange = (s: Date, e: Date | null): string =>
    `${fmtTime(s)}–${fmtTime(e)}`;

  if (!hasResources) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {t.myTasks.notAssigned}
      </section>
    );
  }

  if (todays.length === 0 && rest.length === 0) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {t.myTasks.empty}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {todays.length > 0 && (
        <TaskTable
          heading={t.myTasks.plannedTodayHeading}
          rows={todays}
          t={t}
          fmtRange={fmtRange}
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
                <Link
                  href={`/cases/${r.caseId}`}
                  className="text-xs underline"
                >
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
