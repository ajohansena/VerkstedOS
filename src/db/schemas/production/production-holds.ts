import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { productionHoldKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Production hold — a first-class pause record (docs/10-production-domain.md §
 * Waiting states). A hold has an expected resolution date and resolution
 * criteria; it typically accompanies a transition into a `waiting` state and
 * pauses the production clock for SLA/forecast purposes. A case may hold on
 * several things at once (parts AND insurance approval).
 */
export const productionHolds = pgTable(
  'production_holds',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    holdKind: productionHoldKind('hold_kind').notNull(),
    reason: text('reason'),
    expectedResolutionAt: timestamp('expected_resolution_at', {
      withTimezone: true,
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id'),
    resolutionNote: text('resolution_note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('production_holds_case_idx').on(table.organizationId, table.caseId),
  ],
);
