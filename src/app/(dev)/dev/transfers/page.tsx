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
  listTransfersForOrg,
} from '@/modules/platform/public';
import { repairStuckTransferAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/transfers — transfer history + stuck-transfer repair (Dev surface,
 * Sprint 13). Pick an org, see recent transfers; force-cancel any stuck in
 * initiated/in_transit. Behind the hardened /dev guard.
 */
export default async function DevTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const transfers = configured && org ? await listTransfersForOrg(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transfers</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Transfer history + repair stuck (initiated / in_transit).
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
                    href={`/dev/transfers?org=${organization.id}`}
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
              Transfers ({transfers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {transfers.map((tr) => {
                  const stuck =
                    tr.status === 'initiated' || tr.status === 'in_transit';
                  return (
                    <li
                      key={tr.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-xs text-muted-foreground">
                        {tr.caseId.slice(0, 8)} · {tr.status}
                      </span>
                      {stuck ? (
                        <form action={repairStuckTransferAction}>
                          <input
                            type="hidden"
                            name="organizationId"
                            value={org}
                          />
                          <input
                            type="hidden"
                            name="transferId"
                            value={tr.id}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Force-cancel
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
