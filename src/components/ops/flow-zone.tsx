import Link from 'next/link';

/**
 * Operations Center → Flow Zone (doc 12 §4). A compact "production at a
 * glance" view, grouped by workflow state. Each row is a tap-through to the
 * Production Board filtered to that state.
 *
 * Red-count is the number of cases in that state classified as `red` by the
 * canonical SSoT `classifyCaseRisk`.
 */
export function FlowZone({
  labels,
  groups,
}: {
  labels: {
    flow: string;
    flowEmpty: string;
  };
  groups: {
    stateCode: string;
    stateLabel: string;
    category: 'active' | 'waiting' | 'terminal';
    count: number;
    redCount: number;
  }[];
}) {
  return (
    <section className="rounded-lg border bg-background shadow-sm">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.flow}
        </h2>
      </header>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {labels.flowEmpty}
        </p>
      ) : (
        <ul className="divide-y">
          {groups.map((group) => {
            const dot =
              group.category === 'waiting'
                ? 'bg-amber-400'
                : group.category === 'terminal'
                  ? 'bg-slate-300'
                  : 'bg-emerald-500';
            return (
              <li key={group.stateCode}>
                <Link
                  href={`/production?state=${encodeURIComponent(group.stateCode)}`}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/40"
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`}
                    aria-hidden
                  />
                  <span className="flex-1 truncate font-medium">
                    {group.stateLabel}
                  </span>
                  {group.redCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                      {group.redCount}
                    </span>
                  ) : null}
                  <span className="w-10 text-right tabular-nums text-muted-foreground">
                    {group.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
