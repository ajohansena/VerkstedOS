import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { outboxStatus } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';

/**
 * Outbox events (docs/02-system-architecture.md § Outbox pattern).
 *
 * Domain events are inserted here in the SAME transaction as the mutation that
 * produced them. A separate Inngest cron ships pending rows to Inngest and
 * marks them published — events are emitted only if the originating
 * transaction commits. Append-and-update only; never deleted (audit-tier event).
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: idColumn,
    eventType: varchar('event_type', { length: 128 }).notNull(),
    eventVersion: integer('event_version').notNull().default(1),
    organizationId: uuid('organization_id'),
    workshopId: uuid('workshop_id'),
    actorKind: varchar('actor_kind', { length: 32 }).notNull(),
    actorId: uuid('actor_id'),
    correlationId: uuid('correlation_id'),
    causationId: uuid('causation_id'),
    payload: jsonb('payload').notNull(),
    status: outboxStatus('status').notNull().default('pending'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => [
    // Hot path: the publisher polls pending rows oldest-first.
    index('outbox_events_status_idx').on(table.status, table.occurredAt),
    index('outbox_events_org_idx').on(table.organizationId),
  ],
);
