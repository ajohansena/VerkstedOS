import {
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate labor line — a granular operation from the DBS "Detaljspesifikasjon",
 * grouped by position (Pos.). Each carries a DBS operation code, a name, and a
 * TIME IN PERIODS (100 = 1 hour). These feed work-segment planning in later
 * sprints. Immutable once the import is locked.
 */
export const estimateLaborLines = pgTable(
  'estimate_labor_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    estimateImportId: uuid('estimate_import_id')
      .notNull()
      .references(() => estimateImports.id, { onDelete: 'cascade' }),
    /** Position grouping label, e.g. 'Pos. 14 Dør fremre H'. */
    position: text('position'),
    /** DBS operation code, e.g. '3354'. */
    operationCode: varchar('operation_code', { length: 32 }),
    description: text('description').notNull(),
    /** Labor time in DBS periods (100 = 1 hour). */
    timePeriods: integer('time_periods').notNull().default(0),
    sequenceNo: integer('sequence_no').notNull().default(0),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    index('estimate_labor_lines_import_idx').on(
      table.organizationId,
      table.estimateImportId,
    ),
  ],
);
