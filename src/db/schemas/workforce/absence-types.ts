import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Absence type — catalog of absence reasons per org (vacation, sick leave,
 * etc.). docs/03-data-model.md. `is_paid` and `affects_capacity` drive payroll
 * export and the capacity engine respectively.
 */
export const absenceTypes = pgTable(
  'absence_types',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 32 }).notNull(),
    label: text('label').notNull(),
    isPaid: boolean('is_paid').notNull().default(true),
    affectsCapacity: boolean('affects_capacity').notNull().default(true),
    ...lifecycleColumns,
  },
  (table) => [index('absence_types_org_idx').on(table.organizationId)],
);
