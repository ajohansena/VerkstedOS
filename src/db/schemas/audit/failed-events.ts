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

import { idColumn } from '@/db/schemas/_shared';

/**
 * Failed events (docs/02-system-architecture.md § Retry and DLQ).
 *
 * After an Inngest consumer exhausts its retries, the event lands here with the
 * full error context. Surfaced in the Dev Control Plane for manual replay.
 */
export const failedEvents = pgTable(
  'failed_events',
  {
    id: idColumn,
    /** The originating outbox event id (or replay source). */
    sourceEventId: uuid('source_event_id'),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    organizationId: uuid('organization_id'),
    payload: jsonb('payload').notNull(),
    consumer: varchar('consumer', { length: 128 }),
    error: text('error').notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** Set when this row was created by replaying another event. */
    replayedFromId: uuid('replayed_from_id'),
    failedAt: timestamp('failed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [index('failed_events_type_idx').on(table.eventType)],
);
