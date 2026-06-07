import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { workshopStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Workshop — a physical location operated by an Organization
 * (docs/05-multi-tenant-and-rbac.md). Operationally significant but NOT a
 * tenant boundary; cases live at org level and move freely between workshops.
 */
export const workshops = pgTable(
  'workshops',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    status: workshopStatus('status').notNull().default('active'),
    /** Postal/visiting address as structured data. */
    address: jsonb('address'),
    ...lifecycleColumns,
  },
  (table) => [index('workshops_org_idx').on(table.organizationId)],
);
