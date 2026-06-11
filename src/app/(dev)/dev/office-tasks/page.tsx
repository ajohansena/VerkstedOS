import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  listOfficeTasksForOrgPlatform,
} from '@/modules/platform/public';
import { repairCancelOfficeTaskAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/office-tasks — cross-org office-task inspector + repair (Dev surface,
 * D3 Phase B).
 *
 * Pick an org, see recent tasks; force-cancel any that are stuck (open or
 * in_progress) — used for cleaning up bad waves from Phase F templates.
 * Behind the hardened /dev guard (404 to non-platform).
 */
export default async function DevOfficeTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const tasks =
    configured && org ? await listOfficeTasksForOrgPlatform(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Office tasks</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Per-org office tasks + force-cancel stuck (open / in_progress).
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
                    href={`/dev/office-tasks?org=${organization.id}`}
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
              Tasks ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {tasks.map((t) => {
                  const stuck =
                    t.status === 'open' || t.status === 'in_progress';
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.id.slice(0, 8)}
                        </span>{' '}
                        · <span className="font-medium">{t.title}</span>{' '}
                        ·{' '}
                        <span className="text-xs text-muted-foreground">
                          {t.kind} · {t.priority} · {t.status} · due{' '}
                          {t.dueAt?.toISOString() ?? '—'}
                          {t.generatedFromTemplateId
                            ? ` · tpl ${t.generatedFromTemplateId.slice(0, 6)}`
                            : ''}
                        </span>
                      </div>
                      {stuck ? (
                        <form
                          action={repairCancelOfficeTaskAction}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="organizationId"
                            value={org}
                          />
                          <input type="hidden" name="taskId" value={t.id} />
                          <Input
                            name="reason"
                            placeholder="reason"
                            className="h-7 w-32 text-xs"
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
