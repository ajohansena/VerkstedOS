import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { accountingExportStatus, accountingTarget } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Accounting export (Sprint 15) — an IMMUTABLE record of one push to the
 * accounting system (Tripletex for MVP). The header records what was attempted,
 * its status, the external reference returned, and a content hash so the exact
 * payload that was sent can be proven later (Bokføringsloven traceability).
 *
 * Append-only in spirit: a failed export is retried by creating a NEW export
 * (or bumping `attempt_count` + status), never by editing history. The lines
 * snapshot the amounts at send time.
 */
export const accountingExports = pgTable(
  'accounting_exports',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    target: accountingTarget('target').notNull().default('tripletex'),
    status: accountingExportStatus('status').notNull().default('pending'),
    requestedByUserId: uuid('requested_by_user_id'),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    /** Voucher / ledger reference returned by the accounting system. */
    externalRef: text('external_ref'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    /** SHA-256 of the serialized payload that was sent (immutability evidence). */
    payloadHash: text('payload_hash'),
    ...lifecycleColumns,
  },
  (table) => [
    index('accounting_exports_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
