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
 * Platform audit events — the Dev Control Plane's dedicated audit log, separate
 * from customer audit (docs/06-developer-control-plane.md). Records every
 * platform read of sensitive data, every action, every impersonation.
 *
 * Append-only, partitioned by month on `occurred_at` (hand-authored DDL). Not
 * exported from the schema barrel (queried via the table object directly).
 */
export const platformAuditEvents = pgTable('platform_audit_events', {
  id: uuid('id')
    .notNull()
    .default(sql`gen_random_uuid()`),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  platformUserId: uuid('platform_user_id'),
  platformRoleAtAction: varchar('platform_role_at_action', { length: 32 }),
  targetOrgId: uuid('target_org_id'),
  targetUserId: uuid('target_user_id'),
  targetEntityType: varchar('target_entity_type', { length: 128 }),
  targetEntityId: uuid('target_entity_id'),
  action: varchar('action', { length: 64 }).notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  correlationId: uuid('correlation_id'),
  metadata: jsonb('metadata'),
});
