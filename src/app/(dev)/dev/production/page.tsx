import Link from 'next/link';

import { Button } from '@/components/ui/button';
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
  listSegmentsForOrg,
} from '@/modules/platform/public';
import { recomputeSegmentAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/production — work-segment inspection + actual-minutes recompute repair
 * (Dev surface, Sprint 10). Pick an org, see its segments, and re-derive a
 * drifted actual_minutes from the segment's time entries (same derivation as
 * the canonical completeSegment path). Behind the hardened /dev guard.
 */
export default async function DevProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const segments = configured && org ? await listSegmentsForOrg(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production planning</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Inspect work segments and repair drifted actual_minutes.
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
                    href={`/dev/production?org=${organization.id}`}
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

      {org ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Work segments ({segments.length})
            </CardTitle>
            <CardDescription>
              Planned vs actual minutes. Recompute re-derives actual from time
              entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No segments.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {segments.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.status} · {s.plannedMinutes}p / {s.actualMinutes}a
                        min
                      </span>
                    </div>
                    <form action={recomputeSegmentAction}>
                      <input type="hidden" name="organizationId" value={org} />
                      <input type="hidden" name="segmentId" value={s.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Recompute
                      </Button>
                    </form>
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
