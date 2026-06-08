import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { failedEvents } from '@/db/schemas/audit/failed-events';
import { outboxEvents } from '@/db/schemas/audit/outbox-events';

/**
 * Platform event inspection (Dev surface, /dev/events). Cross-org → service-role
 * connection. Reads the outbox + failed-event tables for monitoring and replay.
 */

export interface OutboxRow {
  readonly id: string;
  readonly eventType: string;
  readonly status: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly occurredAt: Date;
}

export async function listOutbox(limit = 50): Promise<OutboxRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: outboxEvents.id,
      eventType: outboxEvents.eventType,
      status: outboxEvents.status,
      attempts: outboxEvents.attempts,
      lastError: outboxEvents.lastError,
      occurredAt: outboxEvents.occurredAt,
    })
    .from(outboxEvents)
    .orderBy(desc(outboxEvents.occurredAt))
    .limit(limit);
}

export async function outboxCounts(): Promise<{
  pending: number;
  published: number;
  failed: number;
}> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .select({ status: outboxEvents.status })
    .from(outboxEvents);
  let pending = 0;
  let published = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === 'pending') pending += 1;
    if (r.status === 'published') published += 1;
    if (r.status === 'failed') failed += 1;
  }
  return { pending, published, failed };
}

export interface FailedEventRow {
  readonly id: string;
  readonly eventType: string;
  readonly error: string | null;
  readonly failedAt: Date;
}

export async function listFailedEvents(limit = 50): Promise<FailedEventRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: failedEvents.id,
      eventType: failedEvents.eventType,
      error: failedEvents.error,
      failedAt: failedEvents.failedAt,
    })
    .from(failedEvents)
    .orderBy(desc(failedEvents.failedAt))
    .limit(limit);
}

/**
 * Replay an outbox event: reset a failed/pending row to pending so the publisher
 * ships it again. Returns whether a row was affected.
 */
export async function replayOutboxEvent(id: string): Promise<boolean> {
  const db = getRawClient({ as: 'platform-inspector' });
  const result = await db
    .update(outboxEvents)
    .set({ status: 'pending', lastError: null })
    .where(eq(outboxEvents.id, id))
    .returning({ id: outboxEvents.id });
  return result.length > 0;
}
