import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAllOrganizations } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/orgs — cross-org list with platform-level management entry points
 * (Sprint 20). Each row links to `/dev/orgs/[id]` for deactivate/reactivate/
 * archive; the header has a "New organization" button that opens the wizard.
 */
export default async function DevOrgsPage() {
  const configured = isSupabaseConfigured();
  const orgs = configured ? await listAllOrganizations() : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organizations (platform)</h1>
        <Link
          href="/dev/orgs/new"
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          New organization
        </Link>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured — no data to inspect yet.
        </p>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No organizations yet.{' '}
            <Link href="/dev/orgs/new" className="underline">
              Create the first one
            </Link>
            .
          </CardContent>
        </Card>
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
                <li key={organization.id} className="px-3 py-2 text-sm">
                  <Link
                    href={`/dev/orgs/${organization.id}`}
                    className="flex items-center justify-between hover:opacity-80"
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
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
