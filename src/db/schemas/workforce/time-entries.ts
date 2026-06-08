import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { timeEntryKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { clockSessions } from '@/db/schemas/workforce/clock-sessions';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Time entry — logged work time (docs/03-data-model.md). The ORIGINAL entry is
 * event-tier (append-only intent); CORRECTIONS are full-audited (a correction is
 * a new row with `kind='correction'` referencing the original via
 * `corrects_entry_id`, never an in-place edit). Duration is in MINUTES.
 *
 * `funding_source_id` tags billable time (billable-line-tagging rule). When the
 * entry came from a clock session, `clock_session_id` links it.
 */
export const timeEntries = pgTable(
  'time_entries',
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
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    clockSessionId: uuid('clock_session_id').references(
      () => clockSessions.id,
      {
        onDelete: 'set null',
      },
    ),
    segmentCode: varchar('segment_code', { length: 64 }),
    kind: timeEntryKind('kind').notNull().default('work'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** Duration in minutes (computed on clock-out / entered for manual rows). */
    durationMinutes: integer('duration_minutes'),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    /** For corrections: the original entry this row supersedes. */
    correctsEntryId: uuid('corrects_entry_id'),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('time_entries_employee_idx').on(
      table.organizationId,
      table.employeeId,
    ),
    index('time_entries_case_idx').on(table.caseId),
  ],
);
