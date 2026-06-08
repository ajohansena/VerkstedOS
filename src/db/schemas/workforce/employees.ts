import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { employeeStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Employee — a workshop worker (docs/03-data-model.md). SEPARATE from `users`:
 * not every employee logs in (floor technicians may only clock in via a shared
 * device or PIN). `user_id` links to an auth account when the employee logs in.
 */
export const employees = pgTable(
  'employees',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    /** Optional link to an auth user (null = does not log in). */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    fullName: text('full_name').notNull(),
    /** Short clock-in code / employee number (per org). */
    employeeNumber: varchar('employee_number', { length: 32 }),
    email: text('email'),
    phone: varchar('phone', { length: 32 }),
    status: employeeStatus('status').notNull().default('active'),
    ...lifecycleColumns,
  },
  (table) => [
    index('employees_org_workshop_idx').on(
      table.organizationId,
      table.workshopId,
    ),
  ],
);
