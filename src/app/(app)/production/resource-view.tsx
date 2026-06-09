import Link from 'next/link';

/**
 * Production Board v3 — Resource View (doc 13 §4.4). Per-resource 7-day
 * capacity grid. Each cell shows planned minutes vs available minutes with
 * absence minutes subtracted (computed in the composer via the SSoT helper
 * `absenceMinutesInDay`). Drag-to-replan ships later.
 */

export interface ResourceCell {
  date: string; // YYYY-MM-DD
  plannedMin: number;
  availableMin: number;
  absenceMin: number;
}

export interface ResourceRow {
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  cells: ResourceCell[];
}

export function ResourceView({
  rows,
  dates,
  labels,
}: {
  rows: ResourceRow[];
  dates: string[];
  labels: {
    heading: string;
    empty: string;
    planned: string;
    available: string;
    utilization: string;
    absence: string;
    legendOk: string;
    legendTight: string;
    legendOver: string;
  };
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {labels.empty}
      </section>
    );
  }

  const dayLabel = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    return new Intl.DateTimeFormat('nb-NO', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(d);
  };

  const fmtH = (min: number): string =>
    `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)}t`;

  const utilColor = (planned: number, available: number): string => {
    if (available <= 0) return 'bg-muted/40';
    const u = planned / available;
    if (u > 1) return 'bg-red-100 text-red-900';
    if (u >= 0.85) return 'bg-amber-100 text-amber-900';
    return 'bg-emerald-50 text-emerald-900';
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.heading}
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-50" />
            {labels.legendOk}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-amber-100" />
            {labels.legendTight}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-100" />
            {labels.legendOver}
          </span>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
                Ressurs
              </th>
              {dates.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-medium">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.resourceId}>
                <td className="sticky left-0 z-10 bg-background px-3 py-2">
                  <Link
                    href={`/production?mode=day&resource=${r.resourceId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {r.resourceName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.resourceKind}</div>
                </td>
                {r.cells.map((c) => (
                  <td
                    key={c.date}
                    className={`px-2 py-2 text-center ${utilColor(c.plannedMin, c.availableMin)}`}
                  >
                    <div className="font-mono text-xs">
                      {fmtH(c.plannedMin)} / {fmtH(c.availableMin)}
                    </div>
                    {c.absenceMin > 0 ? (
                      <div className="text-[10px] text-muted-foreground">
                        {labels.absence} {fmtH(c.absenceMin)}
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
