'use client';

/**
 * Production Board v3 — Week View (doc 13 § 4.3).
 *
 * Reads the same `ResourceAssignment` data the Day View and Resource View
 * use, but lays it out as Resource × Day (5 weekdays). Each cell shows the
 * first case the resource is on that day plus total planned hours; a colour
 * bar reflects the day's load (emerald < 85 %, amber 85–100 %, red > 100 %).
 *
 * Pure presentation: no inline arithmetic on capacity (uses the SSoT-fed
 * `availableMin` from the page composer); no time conversions outside the
 * helper here.
 */

export interface WeekCell {
  /** YYYY-MM-DD */
  date: string;
  plannedMin: number;
  availableMin: number;
  /** Topmost case for the day, by planned start, for the cell label. */
  topCaseNumber: string | null;
  /** Count of distinct cases the resource works that day (for the badge). */
  caseCount: number;
}

export interface WeekRow {
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  cells: WeekCell[];
}

export interface WeekLabels {
  heading: string;
  empty: string;
  loadDept: string;
  hoursSuffix: string;
  freeLabel: string;
}

export function WeekView({
  rows,
  dates,
  labels,
}: {
  rows: WeekRow[];
  dates: string[];
  labels: WeekLabels;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const dayLoad = dates.map((iso) => {
    let plannedMin = 0;
    let availableMin = 0;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.date === iso);
      if (!cell) continue;
      plannedMin += cell.plannedMin;
      availableMin += cell.availableMin;
    }
    const utilization = availableMin === 0 ? 0 : plannedMin / availableMin;
    return { date: iso, plannedMin, availableMin, utilization };
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{labels.heading}</h2>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-44 px-3 py-2 text-left font-medium">
                {/* spacer */}
              </th>
              {dates.map((iso) => (
                <th key={iso} className="px-3 py-2 text-left font-medium">
                  {formatDayHeader(iso)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.resourceId} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.resourceName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.resourceKind}
                  </div>
                </td>
                {row.cells.map((cell) => {
                  const utilization =
                    cell.availableMin === 0 ? 0 : cell.plannedMin / cell.availableMin;
                  return (
                    <td key={cell.date} className="px-3 py-2 align-top">
                      <div className="text-xs font-medium">
                        {cell.topCaseNumber ?? labels.freeLabel}
                        {cell.caseCount > 1 ? (
                          <span className="ml-1 text-muted-foreground">
                            +{cell.caseCount - 1}
                          </span>
                        ) : null}
                      </div>
                      <UtilizationBar utilization={utilization} />
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {(cell.plannedMin / 60).toFixed(1)}
                        {labels.hoursSuffix}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                {labels.loadDept}
              </td>
              {dayLoad.map((day) => (
                <td key={day.date} className="px-3 py-2">
                  <UtilizationBar utilization={day.utilization} />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {Math.round(day.utilization * 100)}%
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const pct = Math.min(100, Math.round(utilization * 100));
  const color =
    utilization > 1
      ? 'bg-red-500'
      : utilization >= 0.85
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  return (
    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatDayHeader(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const weekday = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'][d.getDay()]!;
  return `${weekday} ${day}/${month}`;
}
