import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { idColumn } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * 1881 phone-directory lookup cache (docs/03-data-model.md — audit tier: none).
 *
 * Caches name/address lookups by phone number from the Norwegian 1881 service.
 * Org-scoped. `found_at` null = negative cache (number not listed).
 */
export const phoneLookups1881 = pgTable(
  'phone_lookups_1881',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    phone: varchar('phone', { length: 32 }).notNull(),
    result: jsonb('result'),
    data: jsonb('data'),
    foundAt: timestamp('found_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('phone_lookups_1881_org_phone_idx').on(
      table.organizationId,
      table.phone,
    ),
  ],
);
