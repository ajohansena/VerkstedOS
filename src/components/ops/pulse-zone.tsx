/**
 * Operations Center → Pulse Zone (doc 12 §4). The handful of operational
 * counters that matter to the role. Operational, not analytical — clicking a
 * tile navigates to the surface where action happens.
 */
export function PulseZone({
  labels,
  pulse,
}: {
  labels: {
    pulse: string;
    pulseActive: string;
    pulseDueToday: string;
    pulseAtRisk: string;
    pulseInProgress: string;
    pulseWorkingNow: string;
    pulseInbound: string;
    pulseOpenParts: string;
  };
  pulse: {
    activeCases: number;
    dueToday: number;
    atRisk: number;
    segmentsInProgress: number;
    workingNow: number;
    inbound: number;
    openParts: number;
  };
}) {
  const tiles: {
    label: string;
    value: number;
    href: string;
    accent?: 'red' | 'amber';
  }[] = [
    { label: labels.pulseActive, value: pulse.activeCases, href: '/production' },
    {
      label: labels.pulseDueToday,
      value: pulse.dueToday,
      href: '/production',
      ...(pulse.dueToday > 0 ? { accent: 'red' } : {}),
    },
    {
      label: labels.pulseAtRisk,
      value: pulse.atRisk,
      href: '/production',
      ...(pulse.atRisk > 0 ? { accent: 'amber' } : {}),
    },
    {
      label: labels.pulseInProgress,
      value: pulse.segmentsInProgress,
      href: '/production',
    },
    { label: labels.pulseWorkingNow, value: pulse.workingNow, href: '/clock' },
    { label: labels.pulseInbound, value: pulse.inbound, href: '/yard' },
    { label: labels.pulseOpenParts, value: pulse.openParts, href: '/parts' },
  ];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {labels.pulse}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {tiles.map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            className="rounded-lg border bg-background p-3 text-sm shadow-sm transition-colors hover:bg-muted/30"
          >
            <div className="text-xs font-medium text-muted-foreground">
              {tile.label}
            </div>
            <div
              className={
                'mt-1 text-2xl font-semibold ' +
                (tile.accent === 'red'
                  ? 'text-red-600'
                  : tile.accent === 'amber'
                    ? 'text-amber-600'
                    : 'text-foreground')
              }
            >
              {tile.value}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
