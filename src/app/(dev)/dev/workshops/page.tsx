import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAllWorkshops } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/workshops — cross-org workshop list (Sprint 20 — Platform Maturity).
 * Read-only. Mutations happen at the org level; this surface is for triage
 * and cross-tenant overview.
 */
export default async function DevWorkshopsPage() {
  const configured = isSupabaseConfigured();
  const workshops = configured ? await listAllWorkshops() : [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workshops (platform)</h1>
        <Link href="/dev/orgs" className="text-sm underline">
          /dev/orgs
        </Link>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured.
        </p>
      ) : workshops.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workshops.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {workshops.length} workshops across{' '}
              {new Set(workshops.map((w) => w.organizationId)).size} orgs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {workshops.map((w) => (
                <li
                  key={w.workshopId}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{w.workshopName}</div>
                    <Link
                      href={`/dev/orgs/${w.organizationId}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {w.organizationName}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.memberCount} default-workshop members ·{' '}
                    {w.workshopStatus}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
