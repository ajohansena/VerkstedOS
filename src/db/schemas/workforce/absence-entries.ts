import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { absenceTypes } from '@/db/schemas/workforce/absence-types';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Absence entry — a single absence period for an employee (docs/03-data-model.md).
 * Feeds the capacity calendar (vacation/sick reduce available minutes).
 */
export const absenceEntries = pgTable(
  'absence_entries',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    absenceTypeId: uuid('absence_type_id')
      .notNull()
      .references(() => absenceTypes.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('absence_entries_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
  ],
);
