import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAllOrganizations } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/orgs — basic cross-org list (Dev surface, Sprint 2 deliverable).
 *
 * NOTE: hardened `/dev` middleware (platform auth + IP allow-list + 404 for
 * non-platform users) is a Sprint 4 deliverable. Until then this is a basic
 * list intended for the platform team only.
 */
export default async function DevOrgsPage() {
  const configured = isSupabaseConfigured();
  const orgs = configured ? await listAllOrganizations() : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organizations (platform)</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured — no data to inspect yet.
        </p>
      ) : orgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organizations.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {orgs.length} organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {orgs.map(({ organization, workshopCount }) => (
                <li
                  key={organization.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{organization.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {organization.id}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {workshopCount} workshop(s) · {organization.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
