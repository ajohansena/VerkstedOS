import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listDashboardHealth } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

const STALE_HOURS = 36;

function freshness(latest: Date | null): {
  label: string;
  tone: 'fresh' | 'stale' | 'missing';
} {
  if (!latest) return { label: 'never', tone: 'missing' };
  const hours = (Date.now() - latest.getTime()) / (1000 * 60 * 60);
  if (hours > STALE_HOURS) {
    return { label: `${Math.round(hours)}h ago`, tone: 'stale' };
  }
  return { label: `${Math.round(hours)}h ago`, tone: 'fresh' };
}

/**
 * /dev/dashboards — cross-org KPI snapshot freshness (Sprint 20).
 * Helps the platform operator spot orgs where the nightly KPI computation
 * has stalled. Drill-in available via /dev/dashboards/[orgId].
 */
export default async function DevDashboardsPage() {
  const configured = isSupabaseConfigured();
  const rows = configured ? await listDashboardHealth() : [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboards (platform)</h1>
        <Link href="/dev" className="text-sm underline">
          /dev
        </Link>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organizations yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              KPI snapshot freshness · stale threshold = {STALE_HOURS}h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {rows.map((r) => {
                const f = freshness(r.latestSnapshotAt);
                return (
                  <li
                    key={r.organizationId}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/dev/dashboards/${r.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {r.organizationName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.kpiDefinitionCount} definitions · {r.snapshotCount}{' '}
                        snapshots
                      </div>
                    </div>
                    <span
                      className={
                        f.tone === 'fresh'
                          ? 'text-xs text-green-700'
                          : f.tone === 'stale'
                            ? 'text-xs text-amber-700'
                            : 'text-xs text-muted-foreground'
                      }
                    >
                      {f.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
