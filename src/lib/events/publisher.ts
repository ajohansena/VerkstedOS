import { asc, eq, sql } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { outboxEvents } from '@/db/schemas/audit/outbox-events';
import type { OutboxEvent } from '@/db/types';

/**
 * Outbox publisher core (docs/02-system-architecture.md § Event architecture).
 *
 * Reads pending outbox rows (oldest first) via the service-role connection,
 * hands each to `send`, and marks it published — or records the error and
 * increments attempts on failure. Pure of any Inngest dependency so it is
 * unit/integration testable; the Inngest function injects the real `send`.
 */

export type SendFn = (event: OutboxEvent) => Promise<void>;

export interface PublishResult {
  published: number;
  failed: number;
}

export async function publishPendingOutbox(
  send: SendFn,
  batchSize = 100,
): Promise<PublishResult> {
  const db = getRawClient({ as: 'integration' });

  const pending = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'pending'))
    .orderBy(asc(outboxEvents.occurredAt))
    .limit(batchSize);

  let published = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      await send(event);
      await db
        .update(outboxEvents)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(outboxEvents.id, event.id));
      published += 1;
    } catch (error) {
      await db
        .update(outboxEvents)
        .set({
          attempts: event.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
          // After repeated failures, flip to 'failed' so it stops blocking.
          status: event.attempts + 1 >= 5 ? 'failed' : 'pending',
        })
        .where(eq(outboxEvents.id, event.id));
      failed += 1;
    }
  }

  return { published, failed };
}

/** Count pending/failed outbox rows (Dev Control Plane monitoring). */
export async function outboxHealth(): Promise<{
  pending: number;
  failed: number;
}> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .select({
      status: outboxEvents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(outboxEvents)
    .groupBy(outboxEvents.status);

  let pending = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.status === 'pending') pending = row.count;
    if (row.status === 'failed') failed = row.count;
  }
  return { pending, failed };
}
