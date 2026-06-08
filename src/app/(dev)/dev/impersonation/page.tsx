import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  listImpersonationSessions,
} from '@/modules/platform/public';
import { endImpersonationAction, startImpersonationAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/impersonation — start/end audited impersonation sessions (Dev surface,
 * Sprint 12). Every action is recorded in platform_impersonation_sessions and
 * platform_audit_events. Behind the hardened /dev guard.
 */
export default async function DevImpersonationPage() {
  const configured = isSupabaseConfigured();
  const [orgs, sessions] = configured
    ? await Promise.all([listAllOrganizations(), listImpersonationSessions()])
    : [[], []];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Impersonation</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a session</CardTitle>
          <CardDescription>
            A reason is mandatory. Start + end are fully audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={startImpersonationAction} className="space-y-2">
            <select
              name="targetOrgId"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {orgs.map(({ organization }) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <Input name="reason" placeholder="Reason (required)" />
            <Button type="submit" size="sm">
              Start impersonation
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="truncate text-xs text-muted-foreground">
                    {s.targetOrgId.slice(0, 8)} · {s.reason}
                  </span>
                  {s.endedAt ? (
                    <span className="text-xs text-muted-foreground">ended</span>
                  ) : (
                    <form action={endImpersonationAction}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <Button type="submit" size="sm" variant="outline">
                        End
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
