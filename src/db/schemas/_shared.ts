import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Standard lifecycle columns shared by every table (docs/03-data-model.md).
 *
 * `created_at` / `updated_at` are mandatory everywhere. `deleted_at` provides
 * soft delete. `created_by` / `updated_by` are the light-audit-tier actor
 * columns; the full before/after audit trail (audit_events + repository
 * wrapper) is added in Sprint 4.
 *
 * These are plain column builders, not an abstraction — spread them into a
 * table definition: `...lifecycleColumns`.
 */
export const lifecycleColumns = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/** Server-generated UUID primary key. */
export const idColumn = uuid('id')
  .primaryKey()
  .default(sql`gen_random_uuid()`);
