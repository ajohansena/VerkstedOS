import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { absenceStatus } from '@/db/enums';
import { absenceTypes } from '@/db/schemas/workforce/absence-types';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Absence entry — a single absence period for an employee (docs/03-data-model.md).
 * Feeds the capacity calendar (vacation/sick reduce available minutes).
 * Sprint 18: adds approval workflow (status + requestedBy/approvedBy + timestamps).
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
    status: absenceStatus('status').notNull().default('requested'),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    requestedAt: timestamp('requested_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    declinedReason: text('declined_reason'),
    ...lifecycleColumns,
  },
  (table) => [
    index('absence_entries_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
    index('absence_entries_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
