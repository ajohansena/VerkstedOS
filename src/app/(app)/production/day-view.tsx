import Link from 'next/link';

/**
 * Production Board v3 — Day View (doc 13 §4.2). Today's planned segments
 * grouped by resource, sorted by planned start. Read-only first pass; drag-
 * to-replan lands in a later sprint (doc 13 §16.2). Office tasks render in a
 * separate "Kontor" lane above the resource rows (doc 13 § 10, D3 Phase E).
 */

export interface DayRow {
  assignmentId: string;
  segmentId: string;
  segmentLabel: string | null;
  caseId: string;
  caseNumber: string;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  status: string;
}

export interface DayOfficeTask {
  taskId: string;
  title: string;
  kind: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueAt: string | null;
  caseId: string | null;
  caseNumber: string | null;
}

export function DayView({
  rows,
  officeTasks = [],
  labels,
}: {
  rows: DayRow[];
  officeTasks?: DayOfficeTask[];
  labels: {
    heading: string;
    empty: string;
    timeColumn: string;
    caseColumn: string;
    resourceColumn: string;
    officeLaneHeading: string;
    officeLaneEmpty: string;
  };
}) {
  if (rows.length === 0 && officeTasks.length === 0) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {labels.empty}
      </section>
    );
  }

  const byResource = new Map<
    string,
    { name: string; kind: string; rows: DayRow[] }
  >();
  for (const r of rows) {
    const entry = byResource.get(r.resourceId);
    if (entry) {
      entry.rows.push(r);
    } else {
      byResource.set(r.resourceId, {
        name: r.resourceName,
        kind: r.resourceKind,
        rows: [r],
      });
    }
  }

  const fmtTime = (iso: string | null): string =>
    iso
      ? new Intl.DateTimeFormat('nb-NO', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(iso))
      : '—';

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {labels.heading}
      </h2>
      <div className="rounded-lg border bg-amber-50/40">
        <header className="flex items-center justify-between border-b border-amber-200/60 px-3 py-2">
          <div className="font-medium">{labels.officeLaneHeading}</div>
          <div className="text-xs text-muted-foreground">
            {officeTasks.length}
          </div>
        </header>
        {officeTasks.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {labels.officeLaneEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-amber-200/40">
            {officeTasks.map((t) => (
              <li
                key={t.taskId}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-16 font-mono text-xs tabular-nums">
                  {fmtTime(t.dueAt)}
                </span>
                <span className="flex-1 truncate">
                  <span className="font-medium">{t.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t.kind} · {t.priority}
                  </span>
                </span>
                {t.caseId && t.caseNumber ? (
                  <Link
                    href={`/cases/${t.caseId}`}
                    className="text-xs underline"
                  >
                    {t.caseNumber}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3">
        {Array.from(byResource.entries()).map(([resourceId, entry]) => (
          <div key={resourceId} className="rounded-lg border bg-background">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <div className="font-medium">{entry.name}</div>
              <div className="text-xs text-muted-foreground">
                {entry.kind} · {entry.rows.length}
              </div>
            </header>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{labels.timeColumn}</th>
                  <th className="px-3 py-2 font-medium">{labels.caseColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entry.rows.map((r) => (
                  <tr key={r.assignmentId}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {fmtTime(r.plannedStartAt)} – {fmtTime(r.plannedEndAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/cases/${r.caseId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.caseNumber}
                      </Link>
                      {r.segmentLabel ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.segmentLabel}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
