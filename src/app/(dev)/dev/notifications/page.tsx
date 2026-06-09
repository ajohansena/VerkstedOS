import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  listDeliveriesForOrg,
  listNotificationsForOrg,
  listRulesForOrgPlatform,
} from '@/modules/platform/public';

import { evaluateForOrg } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/notifications — Notifications inspection + manual evaluate (Dev
 * surface, Sprint 17 — closes CLAUDE.md §6 same-sprint requirement). Pick an
 * org, see rules, recent notifications, and delivery log; trigger a manual
 * engine run that uses the SAME service the cron uses (no ad-hoc SQL).
 */
export default async function DevNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const rules = configured && org ? await listRulesForOrgPlatform(org) : [];
  const notifications =
    configured && org ? await listNotificationsForOrg(org, 50) : [];
  const deliveries =
    configured && org ? await listDeliveriesForOrg(org, 50) : [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
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
                    href={`/dev/notifications?org=${organization.id}`}
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

      {org && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Rules ({rules.length})
              </CardTitle>
              <form action={evaluateForOrg}>
                <input type="hidden" name="org" value={org} />
                <button
                  type="submit"
                  className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  Evaluate now
                </button>
              </form>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rules.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">Code</th>
                      <th className="px-2 py-1">Category</th>
                      <th className="px-2 py-1">Severity</th>
                      <th className="px-2 py-1">Enabled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-1 font-mono text-xs">{r.code}</td>
                        <td className="px-2 py-1">{r.category}</td>
                        <td className="px-2 py-1">{r.severity}</td>
                        <td className="px-2 py-1">{r.enabled ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent notifications ({notifications.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">When</th>
                      <th className="px-2 py-1">Rule</th>
                      <th className="px-2 py-1">Severity</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Body</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {notifications.map((n) => (
                      <tr key={n.id}>
                        <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">
                          {n.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className="px-2 py-1 font-mono text-xs">
                          {n.ruleCode}
                        </td>
                        <td className="px-2 py-1">{n.severity}</td>
                        <td className="px-2 py-1">{n.status}</td>
                        <td className="px-2 py-1 max-w-md truncate">{n.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Delivery log ({deliveries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">When</th>
                      <th className="px-2 py-1">Channel</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">
                          {d.attemptedAt
                            ? d.attemptedAt
                                .toISOString()
                                .replace('T', ' ')
                                .slice(0, 16)
                            : '—'}
                        </td>
                        <td className="px-2 py-1">{d.channel}</td>
                        <td className="px-2 py-1">{d.status}</td>
                        <td className="px-2 py-1 max-w-md truncate text-rose-600">
                          {d.errorMessage ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
