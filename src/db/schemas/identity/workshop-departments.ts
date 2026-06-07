import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Department — a lightweight functional grouping within a Workshop (Body,
 * Paint, Mechanical, Assembly, ...). Used for resource grouping and optional
 * RBAC scoping (docs/05-multi-tenant-and-rbac.md, ADR-016).
 */
export const workshopDepartments = pgTable(
  'workshop_departments',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** Functional kind, e.g. 'body' | 'paint' | 'mechanical' | 'assembly'. */
    kind: varchar('kind', { length: 32 }),
    ...lifecycleColumns,
  },
  (table) => [
    index('workshop_departments_org_workshop_idx').on(
      table.organizationId,
      table.workshopId,
    ),
  ],
);
