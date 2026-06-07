import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { idColumn } from '@/db/schemas/_shared';

/**
 * Insurance company — a PLATFORM-SHARED catalog, not org-scoped
 * (docs/03-data-model.md, docs/05-multi-tenant-and-rbac.md). Every organization
 * references the same Fremtind / If / Gjensidige / Tryg rows. Per-org specifics
 * (commission rates, account refs) live in an org-level overlay added later.
 *
 * This table intentionally has NO `organization_id` and is exposed read-only to
 * all tenants (see the RLS migration).
 */
export const insuranceCompanies = pgTable(
  'insurance_companies',
  {
    id: idColumn,
    /** Short stable code, e.g. 'fremtind', 'if', 'gjensidige'. */
    code: varchar('code', { length: 32 }).notNull(),
    name: text('name').notNull(),
    /** Norwegian organisasjonsnummer, when known. */
    orgNumber: varchar('org_number', { length: 16 }),
    /** ISO 3166-1 alpha-2 country code. */
    country: varchar('country', { length: 2 }).notNull().default('NO'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('insurance_companies_code_uq').on(table.code)],
);
