import {
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  partCondition,
  partRequirementSource,
  partRequirementStatus,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { estimateParts } from '@/db/schemas/estimating/estimate-parts';
import { organizations } from '@/db/schemas/identity/organizations';
import { workSegments } from '@/db/schemas/production/work-segments';

/**
 * Part requirement — THE parts spine (docs/03-data-model.md). One per "needed
 * part" on a case. A single requirement can be satisfied by any combination of
 * purchase-order lines, inventory withdrawals, and replacements after returns.
 *
 * GUARDRAIL (TakstKontroll, CLAUDE.md § 4.7): the requirement keeps case-level
 * traceability for the WHOLE lifecycle. `funding_source_id` is tagged so the
 * billable position stays funding-traceable. `estimate_part_id` links back to
 * the immutable estimate line it derives from (when sourced from an estimate).
 */
export const partRequirements = pgTable(
  'part_requirements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    /** The estimate part line this derives from (immutable), when applicable. */
    estimatePartId: uuid('estimate_part_id').references(
      () => estimateParts.id,
      {
        onDelete: 'set null',
      },
    ),
    /** The work segment that consumes this part, when known. */
    workSegmentId: uuid('work_segment_id').references(() => workSegments.id, {
      onDelete: 'set null',
    }),
    source: partRequirementSource('source').notNull().default('manual'),
    partNumber: varchar('part_number', { length: 64 }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    condition: partCondition('condition').notNull().default('new'),
    /** Funding source this part is billed to (nullable while estimating). */
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    /** Estimated unit cost (for reconciliation against the actual PO price). */
    unitCostEstimate: numeric('unit_cost_estimate', {
      precision: 14,
      scale: 2,
    }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    status: partRequirementStatus('status').notNull().default('needed'),
    requestedByUserId: uuid('requested_by_user_id'),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('part_requirements_case_idx').on(
      table.organizationId,
      table.caseId,
      table.status,
    ),
  ],
);
