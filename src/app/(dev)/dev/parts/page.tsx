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
  listLifecycleForRequirement,
  listRequirementsForOrg,
} from '@/modules/platform/public';
import { rebuildRequirementAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/parts — part requirement inspection + status-rebuild repair (Dev
 * surface, Sprint 11). Pick an org, see its requirements, inspect a
 * requirement's lifecycle timeline, and re-derive a drifted status from the
 * actual quantities (same reconciliation calculation as customer code). Behind
 * the hardened /dev guard.
 */
export default async function DevPartsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; req?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org, req } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const requirements =
    configured && org ? await listRequirementsForOrg(org) : [];
  const lifecycle =
    configured && org && req ? await listLifecycleForRequirement(org, req) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parts</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Inspect part requirements and repair drifted status.
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
                    href={`/dev/parts?org=${organization.id}`}
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
              Part requirements ({requirements.length})
            </CardTitle>
            <CardDescription>
              Rebuild re-derives status from ordered/received/returned
              quantities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requirements.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {requirements.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{r.description}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.status} · qty {r.quantity}
                      </span>
                    </div>
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/dev/parts?org=${org}&req=${r.id}`}
                        className="text-xs underline"
                      >
                        Timeline
                      </Link>
                      <form action={rebuildRequirementAction}>
                        <input
                          type="hidden"
                          name="organizationId"
                          value={org}
                        />
                        <input
                          type="hidden"
                          name="requirementId"
                          value={r.id}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Rebuild
                        </Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {req ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lifecycle timeline ({lifecycle.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lifecycle.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {lifecycle.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>{e.kind}</span>
                    <span>{e.occurredAt.toISOString().slice(0, 16)}</span>
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
