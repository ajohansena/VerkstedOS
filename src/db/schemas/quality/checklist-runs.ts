import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { checklistRunStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { checklistTemplates } from '@/db/schemas/quality/checklist-templates';
import { organizations } from '@/db/schemas/identity/organizations';
import { workSegments } from '@/db/schemas/production/work-segments';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Checklist run — a checklist performed against a case (docs/03-data-model.md).
 * Status is DERIVED from the responses: any failed required item → `failed`,
 * else `passed` once signed off. The sign-off requires `quality:signoff`.
 * Records the workshop where QC happened (immutable, multi-location).
 */
export const checklistRuns = pgTable(
  'checklist_runs',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: 'restrict' }),
    /** Where the QC was performed (immutable). */
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    /** The segment this QC relates to, when applicable. */
    workSegmentId: uuid('work_segment_id').references(() => workSegments.id, {
      onDelete: 'set null',
    }),
    status: checklistRunStatus('status').notNull().default('in_progress'),
    startedByUserId: uuid('started_by_user_id'),
    signedOffByUserId: uuid('signed_off_by_user_id'),
    signedOffAt: timestamp('signed_off_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('checklist_runs_case_idx').on(
      table.organizationId,
      table.caseId,
      table.status,
    ),
  ],
);
