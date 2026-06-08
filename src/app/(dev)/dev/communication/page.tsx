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
  listAcceptancesForOrg,
  listAllOrganizations,
  listQueuedMessagesForOrg,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/communication — acceptance + message inspection (Dev surface, Sprint 12).
 * Pick an org, see recent customer acceptances (status + method) and the
 * outbound message backlog (queued when no SMS/email provider is configured).
 * Behind the hardened /dev guard.
 */
export default async function DevCommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const acceptances = configured && org ? await listAcceptancesForOrg(org) : [];
  const messages = configured && org ? await listQueuedMessagesForOrg(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Communication</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Acceptances + the outbound message backlog (queued = no provider).
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
                    href={`/dev/communication?org=${organization.id}`}
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Acceptances ({acceptances.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {acceptances.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {acceptances.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="truncate text-xs text-muted-foreground">
                        {a.caseId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.status} · {a.method ?? '—'} · {a.channel ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Messages ({messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="text-xs text-muted-foreground">
                        {m.direction} · {m.channel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
