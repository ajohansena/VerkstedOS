import Link from 'next/link';

export interface KpiTileData {
  code: string;
  value: number;
  unit: 'count' | 'days' | 'percent' | 'currency' | 'hours';
  direction: 'up' | 'down';
  sampleSize: number | null;
  computedAt: string | null;
}

const UNIT_SUFFIX: Record<KpiTileData['unit'], string> = {
  count: '',
  days: ' d',
  percent: ' %',
  currency: ' kr',
  hours: ' t',
};

/**
 * KPI tile (docs/11 shared components). Shows one rolling-30 KPI value with its
 * label and sample size. Pure presentation — the value is already computed by a
 * registered SSoT calculation and stored as a snapshot.
 */
export function KpiTile({
  data,
  label,
  href,
}: {
  data: KpiTileData | undefined;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {data ? `${data.value}${UNIT_SUFFIX[data.unit]}` : '—'}
      </div>
      {data?.sampleSize != null ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          n={data.sampleSize}
        </div>
      ) : null}
    </>
  );
  const className =
    'rounded-lg border bg-background p-3 shadow-sm transition-colors';
  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-muted/30`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
