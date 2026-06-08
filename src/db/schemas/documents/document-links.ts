import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { documentLinkEntityType, documentLinkRole } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { documents } from '@/db/schemas/documents/documents';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Document link — polymorphic many-to-many between a document and any entity
 * (docs/04-document-architecture.md). A document can be linked to a case, a
 * claim, a work segment, etc., with a ROLE (e.g. before_photo). Links — not
 * copies — are how documents "follow" a case across workshops.
 */
export const documentLinks = pgTable(
  'document_links',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    linkedEntityType: documentLinkEntityType('linked_entity_type').notNull(),
    linkedEntityId: uuid('linked_entity_id').notNull(),
    role: documentLinkRole('role').notNull().default('attachment'),
    linkedByUserId: uuid('linked_by_user_id'),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...lifecycleColumns,
  },
  (table) => [
    index('document_links_entity_idx').on(
      table.organizationId,
      table.linkedEntityType,
      table.linkedEntityId,
    ),
    index('document_links_document_idx').on(
      table.organizationId,
      table.documentId,
    ),
  ],
);
