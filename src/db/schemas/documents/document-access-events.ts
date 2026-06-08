import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { documentAccessAction } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { documents } from '@/db/schemas/documents/documents';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Document access event — append-only access log (docs/04-document-architecture.md).
 * Records every view / download / signed-URL issuance for confidential and
 * restricted documents (the audit trail for sensitive files). APPEND-ONLY at
 * the RLS level (INSERT + SELECT only); keyed by `occurred_at`, no lifecycle
 * columns.
 */
export const documentAccessEvents = pgTable(
  'document_access_events',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    action: documentAccessAction('action').notNull(),
    actorUserId: uuid('actor_user_id'),
    /** Optional context: IP, signed-URL TTL, user agent. */
    detail: text('detail'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('document_access_events_doc_idx').on(
      table.organizationId,
      table.documentId,
      table.occurredAt,
    ),
  ],
);
