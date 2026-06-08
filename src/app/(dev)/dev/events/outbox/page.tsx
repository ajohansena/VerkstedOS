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
import { listOutbox, outboxCounts } from '@/modules/platform/public';

import { replayEventAction } from '../actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/events/outbox — outbox publisher monitoring (Dev surface, Sprint 8).
 * Shows pending/published/failed counts and the latest events, with a replay
 * control. Behind the hardened /dev guard.
 */
export default async function DevOutboxPage() {
  const configured = isSupabaseConfigured();
  const [rows, counts] = configured
    ? await Promise.all([listOutbox(), outboxCounts()])
    : [[], { pending: 0, published: 0, failed: 0 }];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Outbox</h1>
        <Link href="/dev/events/failed" className="text-sm underline">
          Failed events →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle>{counts.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Published</CardDescription>
            <CardTitle>{counts.published}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed</CardDescription>
            <CardTitle>{counts.failed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{r.eventType}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {r.status}
                      {r.attempts > 0 ? ` · ${r.attempts} attempt(s)` : ''}
                    </span>
                    {r.status !== 'published' ? (
                      <form action={replayEventAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Replay
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No events.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
