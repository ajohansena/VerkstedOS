import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { qualityDeviationSeverity, qualityDeviationStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { checklistRuns } from '@/db/schemas/quality/checklist-runs';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Quality deviation — a recorded defect / non-conformance (docs/03-data-model.md,
 * CLAUDE.md § 4.7). Raised from a failed checklist item or ad hoc. When the
 * defect causes rework absorbed by the workshop, it links the
 * `internal_rework` funding source (`rework_funding_source_id`) so the rework
 * cost stays separable and counts in the rework-rate KPI. Keeping rework
 * separable is a TakstKontroll-compatibility requirement.
 */
export const qualityDeviations = pgTable(
  'quality_deviations',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    /** The checklist run that surfaced this, when applicable. */
    checklistRunId: uuid('checklist_run_id').references(
      () => checklistRuns.id,
      {
        onDelete: 'set null',
      },
    ),
    title: text('title').notNull(),
    description: text('description'),
    severity: qualityDeviationSeverity('severity').notNull().default('minor'),
    status: qualityDeviationStatus('status').notNull().default('open'),
    /** Links the internal_rework funding source when rework is needed. */
    reworkFundingSourceId: uuid('rework_funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    raisedByUserId: uuid('raised_by_user_id'),
    resolvedByUserId: uuid('resolved_by_user_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('quality_deviations_case_idx').on(
      table.organizationId,
      table.caseId,
      table.status,
    ),
  ],
);
