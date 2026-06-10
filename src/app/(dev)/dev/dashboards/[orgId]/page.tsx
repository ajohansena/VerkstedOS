import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { inspectDashboardOrg } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

export default async function DevDashboardsOrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const detail = await inspectDashboardOrg(orgId);
  if (!detail) notFound();

  const byCode = new Map<string, (typeof detail.latestSnapshots)[number]>();
  for (const s of detail.latestSnapshots) {
    if (!byCode.has(s.kpiCode)) byCode.set(s.kpiCode, s);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{detail.organizationName}</h1>
        <Link href="/dev/dashboards" className="text-sm underline">
          ← back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            KPI definitions ({detail.definitions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.definitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No definitions.</p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {detail.definitions.map((d) => (
                <li key={d.code} className="flex justify-between">
                  <span className="font-mono">{d.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.category} · {d.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest snapshot per KPI</CardTitle>
        </CardHeader>
        <CardContent>
          {byCode.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No snapshots yet. Run the nightly KPI job.
            </p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {Array.from(byCode.values()).map((s) => (
                <li
                  key={s.kpiCode}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-mono">{s.kpiCode}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.value} · {s.period} ·{' '}
                    {new Date(s.computedAt).toISOString().slice(0, 16)}Z
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
