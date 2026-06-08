import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { dbsInboxStats, listDbsInbox } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/integrations/dbs — DBS import monitoring (Dev surface, Sprint 7).
 * Shows the integration inbox: received / processed / failed payloads with parse
 * errors. Behind the hardened /dev guard (layout). Replay tooling builds on the
 * stored raw payloads in later sprints.
 */
export default async function DevDbsPage() {
  const configured = isSupabaseConfigured();
  const [items, stats] = configured
    ? await Promise.all([listDbsInbox(), dbsInboxStats()])
    : [[], { received: 0, processed: 0, failed: 0 }];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">DBS integration</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle>{stats.received}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Processed</CardDescription>
            <CardTitle>{stats.processed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed</CardDescription>
            <CardTitle>{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbox ({items.length})</CardTitle>
          <CardDescription>Latest DBS payloads received.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {items.map((item) => (
                <li key={item.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">
                      {item.externalRef ?? item.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                  {item.parseError ? (
                    <p className="mt-1 text-xs text-destructive">
                      {item.parseError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No DBS payloads yet.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
