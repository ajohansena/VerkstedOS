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
 * Vegvesen lookup cache (docs/03-data-model.md — audit tier: none).
 *
 * Caches registration-plate lookups from the Norwegian Public Roads
 * Administration (Statens vegvesen). Org-scoped so each tenant's lookups are
 * isolated. `fetched_at` + a TTL policy in the adapter decide staleness; the raw
 * provider response is kept in `data` for re-parsing.
 */
export const vegvesenLookups = pgTable(
  'vegvesen_lookups',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    registrationNumber: varchar('registration_number', {
      length: 16,
    }).notNull(),
    /** Normalized fields the UI consumes (make, model, year, vin, colour, ...). */
    result: jsonb('result'),
    /** Raw provider payload, for re-parsing without another call. */
    data: jsonb('data'),
    /** Null when the plate was not found (negative cache). */
    foundAt: timestamp('found_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('vegvesen_lookups_org_reg_idx').on(
      table.organizationId,
      table.registrationNumber,
    ),
  ],
);
