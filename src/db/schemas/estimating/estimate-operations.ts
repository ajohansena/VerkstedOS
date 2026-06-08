import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { estimateLineCategory } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate operation — a line from the DBS "Arbeidsspesifikasjon" (work spec).
 * Each is an operation on a part/area with an action (Tiltak: Skift/replace,
 * Løsne/loosen, etc.), a side (H=høyre/right, V=venstre/left), and a TIME IN
 * PERIODS (100 periods = 1 hour — see periods->hours calc in the metric
 * registry). Immutable once the import is locked.
 *
 * `funding_source_id` tags the line to a payer (nullable while estimating,
 * required when locked/invoiced — billable-line-tagging rule, docs/03).
 */
export const estimateOperations = pgTable(
  'estimate_operations',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    estimateImportId: uuid('estimate_import_id')
      .notNull()
      .references(() => estimateImports.id, { onDelete: 'cascade' }),
    category: estimateLineCategory('category').notNull().default('body_labor'),
    /** Operation/part name as printed (e.g. 'H Forskjerm'). */
    description: text('description').notNull(),
    /** DBS action text (Tiltak), e.g. 'Skift', 'Skift Justert pris'. */
    action: varchar('action', { length: 64 }),
    /** Side: 'H' (right) | 'V' (left) | null. */
    side: varchar('side', { length: 2 }),
    /** Labor time in DBS periods (100 = 1 hour). */
    timePeriods: integer('time_periods').notNull().default(0),
    /** Labor rate (Deb.faktor) NOK/hour, when present on the line. */
    laborRate: numeric('labor_rate', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    sequenceNo: integer('sequence_no').notNull().default(0),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    index('estimate_operations_import_idx').on(
      table.organizationId,
      table.estimateImportId,
    ),
  ],
);
