import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { customerKind, identifierKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Customer — unified table with a `kind` discriminator (ADR-015,
 * docs/03-data-model.md). Org-scoped; uniqueness is at organization level.
 *
 * Insurance companies are NOT customers — they are a platform-shared catalog
 * (`insurance_companies`).
 */
export const customers = pgTable(
  'customers',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    kind: customerKind('kind').notNull(),
    name: text('name').notNull(),
    /** personnummer (individual) or organisasjonsnummer (company), when known. */
    identifier: varchar('identifier', { length: 32 }),
    identifierKind: identifierKind('identifier_kind'),
    billingAddress: jsonb('billing_address'),
    primaryEmail: text('primary_email'),
    primaryPhone: varchar('primary_phone', { length: 32 }),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('customers_org_idx').on(table.organizationId),
    // Org-level uniqueness on identifier for live rows only.
    uniqueIndex('customers_org_identifier_uq')
      .on(table.organizationId, table.identifier)
      .where(
        sql`${table.identifier} is not null and ${table.deletedAt} is null`,
      ),
  ],
);
