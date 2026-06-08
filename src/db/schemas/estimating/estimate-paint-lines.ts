import {
  index,
  integer,
  numeric,
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
 * Estimate paint line — paint labor/material from the DBS "Lakkarbeide" /
 * "Lakkmateriell" sections. Paint has a different resource profile (booth, cure)
 * than body work, so it is modeled separately. Time in PERIODS (100 = 1 hour).
 * Immutable once the import is locked.
 */
export const estimatePaintLines = pgTable(
  'estimate_paint_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    estimateImportId: uuid('estimate_import_id')
      .notNull()
      .references(() => estimateImports.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    /** True for paint material (Lakkmateriell), false for paint labor. */
    isMaterial: integer('is_material').notNull().default(0),
    /** Paint labor time in DBS periods (100 = 1 hour); 0 for material lines. */
    timePeriods: integer('time_periods').notNull().default(0),
    laborRate: numeric('labor_rate', { precision: 14, scale: 2 }),
    /** Material amount (for Lakkmateriell lines). */
    amount: numeric('amount', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    sequenceNo: integer('sequence_no').notNull().default(0),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    index('estimate_paint_lines_import_idx').on(
      table.organizationId,
      table.estimateImportId,
    ),
  ],
);
