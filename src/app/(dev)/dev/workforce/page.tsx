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
  listOpenSessions,
  listTimeCorrections,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/workforce — clock session + time correction inspection (Dev surface,
 * Sprint 9). Open sessions across all orgs + the time-correction audit view.
 * Behind the hardened /dev guard.
 */
export default async function DevWorkforcePage() {
  const configured = isSupabaseConfigured();
  const [sessions, corrections] = configured
    ? await Promise.all([listOpenSessions(), listTimeCorrections()])
    : [[], []];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workforce</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Open clock sessions ({sessions.length})
          </CardTitle>
          <CardDescription>Employees currently clocked in.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{s.employeeName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.segmentCode ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open sessions.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Time corrections ({corrections.length})
          </CardTitle>
          <CardDescription>
            Full-audited corrections (new rows, never in-place edits).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {corrections.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {corrections.map((c) => (
                <li key={c.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{c.employeeName}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.durationMinutes ?? '—'} min
                    </span>
                  </div>
                  {c.note ? (
                    <p className="text-xs text-muted-foreground">{c.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No corrections.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
