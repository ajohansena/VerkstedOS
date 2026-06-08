import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { integrationInboxStatus } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Integration inbox — the webhook/file landing zone (docs/02 § Webhook handling,
 * ADR-004). Raw inbound payloads (e.g. a DBS `sendOppdrag` takst) land here
 * first and are processed asynchronously, so an import is never lost and can be
 * replayed. Audit tier: event (the row IS the record); `payload` is the raw,
 * unmodified provider data.
 *
 * `organization_id` is nullable because the org may be resolved during
 * processing (from the API key or payload). Writes happen via the service-role
 * connection before org context is known.
 */
export const integrationInbox = pgTable(
  'integration_inbox',
  {
    id: idColumn,
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    /** Provider/source, e.g. 'dbs'. */
    source: text('source').notNull(),
    /** Message kind, e.g. 'sendOppdrag' / 'takst' / 'supplement'. */
    messageType: text('message_type'),
    /** Provider's correlation identifiers (oppdragsId, skadenr) for dedupe. */
    externalRef: text('external_ref'),
    status: integrationInboxStatus('status').notNull().default('received'),
    /** Raw, unmodified provider payload. */
    payload: jsonb('payload').notNull(),
    parseError: text('parse_error'),
    /** The estimate import this produced, once processed. */
    producedImportId: uuid('produced_import_id'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    index('integration_inbox_status_idx').on(table.status),
    index('integration_inbox_external_ref_idx').on(table.externalRef),
  ],
);
