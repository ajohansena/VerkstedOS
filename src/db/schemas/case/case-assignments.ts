import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { caseAssignmentRole, caseAssignmentStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshopDepartments } from '@/db/schemas/identity/workshop-departments';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Case assignment — a temporal placement of a case at a workshop
 * (docs/03-data-model.md, multi-location). The case stays single; assignments
 * are temporal and CAN REPEAT (A → B → A is two assignments to A). `sequence_no`
 * orders them over the case lifetime; the active one drives
 * `cases.current_workshop_id`.
 */
export const caseAssignments = pgTable(
  'case_assignments',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'restrict' }),
    departmentId: uuid('department_id').references(
      () => workshopDepartments.id,
      { onDelete: 'set null' },
    ),
    role: caseAssignmentRole('role').notNull().default('other'),
    sequenceNo: integer('sequence_no').notNull().default(0),
    status: caseAssignmentStatus('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_assignments_case_idx').on(
      table.organizationId,
      table.caseId,
      table.sequenceNo,
    ),
    index('case_assignments_workshop_idx').on(
      table.organizationId,
      table.workshopId,
      table.status,
    ),
  ],
);
