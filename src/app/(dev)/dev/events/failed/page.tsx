import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listFailedEvents } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/events/failed — dead-lettered events (Dev surface, Sprint 8). Events that
 * exhausted consumer retries, with the full error. Replay tooling reuses the
 * outbox replay path. Behind the hardened /dev guard.
 */
export default async function DevFailedEventsPage() {
  const configured = isSupabaseConfigured();
  const rows = configured ? await listFailedEvents() : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Failed events</h1>
        <Link href="/dev/events/outbox" className="text-sm underline">
          ← Outbox
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Dead-letter queue ({rows.length})
          </CardTitle>
          <CardDescription>
            Events that exhausted consumer retries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{r.eventType}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.failedAt.toISOString?.() ?? ''}
                    </span>
                  </div>
                  {r.error ? (
                    <p className="mt-1 text-xs text-destructive">{r.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No failed events. 🎉
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
