import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  qcSummaryForOrg,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/quality — QC inspection (Dev surface, Sprint 12). Pick an org, see its
 * checklist runs + the QC failure rate (computed via the canonical calculation)
 * and open deviation count. Behind the hardened /dev guard.
 */
export default async function DevQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const summary = configured && org ? await qcSummaryForOrg(org) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quality</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            QC failure rate + recent runs (canonical calculation).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {orgs.map(({ organization }) => (
                <li
                  key={organization.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{organization.name}</span>
                  <Link
                    href={`/dev/quality?org=${organization.id}`}
                    className="text-xs underline"
                  >
                    Inspect
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Runs ({summary.runs.length})
            </CardTitle>
            <CardDescription>
              QC failure rate {(summary.failureRate * 100).toFixed(1)}% ·{' '}
              {summary.openDeviations} deviation(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {summary.runs.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate text-xs text-muted-foreground">
                      {r.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
