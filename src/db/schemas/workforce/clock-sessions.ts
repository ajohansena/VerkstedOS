import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { clockSessionStatus } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Clock session — an open/closed clock-in span (docs/03-data-model.md, audit
 * tier: event). ONE open session per employee is enforced by a partial unique
 * index (`status = 'open'`). Optionally tied to a case (and later a work
 * segment, Sprint 10) so clock activity can drive production progress — the
 * Sprint 10 guardrail link.
 */
export const clockSessions = pgTable(
  'clock_sessions',
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
    /** Optional case the clock-in is against. */
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    /** Segment code the employee clocked into (e.g. 'paint_preparation').
     *  Becomes a work_segment_id FK in Sprint 10. */
    segmentCode: varchar('segment_code', { length: 64 }),
    status: clockSessionStatus('status').notNull().default('open'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('clock_sessions_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
    // One OPEN session per employee — enforced as a partial unique index in the
    // RLS/constraint migration (Drizzle partial unique on a single column).
    index('clock_sessions_status_idx').on(table.status),
  ],
);
