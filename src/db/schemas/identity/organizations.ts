import { jsonb, text, varchar } from 'drizzle-orm/pg-core';

import { organizationStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { pgTable } from 'drizzle-orm/pg-core';

/**
 * Organization — the tenant root (docs/05-multi-tenant-and-rbac.md).
 *
 * A chain and a single shop are both just Organizations; an "enterprise group"
 * is an Organization with multiple workshops. This table is platform-scoped
 * (it has no `organization_id` of its own — it IS the org).
 */
export const organizations = pgTable('organizations', {
  id: idColumn,
  name: text('name').notNull(),
  /** Norwegian organisasjonsnummer (9 digits), when known. */
  orgNumber: varchar('org_number', { length: 16 }),
  status: organizationStatus('status').notNull().default('active'),
  /** Org-level configuration bag (locale, case-number format, etc.). */
  settings: jsonb('settings').notNull().default({}),
  ...lifecycleColumns,
});
