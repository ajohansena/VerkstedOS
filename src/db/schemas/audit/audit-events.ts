import { sql } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Audit events — the full-audit-tier log (docs/03-data-model.md § Audit).
 *
 * Append-only, partitioned by month on `occurred_at` (the partitioned DDL is
 * hand-authored in the migration; this object is for type-safe queries only and
 * is intentionally NOT exported from the schema barrel so drizzle-kit does not
 * try to generate a plain table for it). Corrections are new rows; never
 * updated or deleted (enforced by RLS: INSERT/SELECT only).
 *
 * `reason` is required for transitions/deletions (enforced in the repository
 * wrapper at the TypeScript boundary, see src/lib/audit/audit-writer.ts).
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id')
    .notNull()
    .default(sql`gen_random_uuid()`),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  organizationId: uuid('organization_id').notNull(),
  workshopId: uuid('workshop_id'),
  actorUserId: uuid('actor_user_id'),
  actorKind: varchar('actor_kind', { length: 32 }).notNull(),
  impersonatedUserId: uuid('impersonated_user_id'),
  entityTable: varchar('entity_table', { length: 128 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  correlationId: uuid('correlation_id'),
  causedByEventId: uuid('caused_by_event_id'),
});
