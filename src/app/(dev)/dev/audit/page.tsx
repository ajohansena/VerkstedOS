import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { searchAuditEvents } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/audit — cross-org audit log search (Dev surface). Access is enforced by
 * the (dev) layout guard. Filters via query params (org, entity, action).
 */
export default async function DevAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; entity?: string; action?: string }>;
}) {
  const { org, entity, action } = await searchParams;
  const events = await searchAuditEvents({
    ...(org ? { organizationId: org } : {}),
    ...(entity ? { entityTable: entity } : {}),
    ...(action ? { action } : {}),
    limit: 100,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <Link href="/dev/inspect" className="text-sm underline">
          /dev/inspect
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {events.length} event(s)
            {org ? ` · org ${org}` : ''}
            {entity ? ` · ${entity}` : ''}
            {action ? ` · ${action}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit events match.
            </p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {events.map((e) => (
                <li key={`${e.id}`} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {e.entityTable} · {e.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.occurredAt.toISOString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    entity {e.entityId} · actor {e.actorUserId ?? e.actorKind}
                    {e.reason ? ` · reason: ${e.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
