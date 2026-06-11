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
  listTaskTemplatesForOrgPlatform,
} from '@/modules/platform/public';

import { repairDisableTaskTemplateAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/task-templates — cross-org template inspector + force-disable
 * (Dev surface, D3 Phase F). Hardened behind the /dev guard.
 */
export default async function DevTaskTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const templates =
    configured && org ? await listTaskTemplatesForOrgPlatform(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Task templates</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Per-org templates + force-disable a runaway template.
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
                    href={`/dev/task-templates?org=${organization.id}`}
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
              Templates ({templates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs text-muted-foreground">
                        {tpl.id.slice(0, 8)}
                      </span>{' '}
                      · <span className="font-medium">{tpl.name}</span>{' '}
                      ·{' '}
                      <span className="text-xs text-muted-foreground">
                        {tpl.triggerEventType} · {tpl.taskKind} ·{' '}
                        {tpl.dueOffsetMinutes}m / {tpl.dueReference} ·{' '}
                        {tpl.isActive ? 'active' : 'inactive'}
                      </span>
                    </div>
                    {tpl.isActive ? (
                      <form action={repairDisableTaskTemplateAction}>
                        <input
                          type="hidden"
                          name="organizationId"
                          value={org}
                        />
                        <input
                          type="hidden"
                          name="templateId"
                          value={tpl.id}
                        />
                        <button
                          type="submit"
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Force-disable
                        </button>
                      </form>
                    ) : null}
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
