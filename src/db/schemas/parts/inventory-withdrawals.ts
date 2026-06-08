import { index, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { inventoryItems } from '@/db/schemas/parts/inventory-items';
import { organizations } from '@/db/schemas/identity/organizations';
import { partRequirements } from '@/db/schemas/parts/part-requirements';

/**
 * Inventory withdrawal — an ALTERNATIVE satisfaction path for a part
 * requirement: pull from stock instead of ordering (docs/03-data-model.md).
 * Carries `funding_source_id` so the withdrawn part stays billable
 * (TakstKontroll, § 4.7). Each withdrawal also writes a stock movement.
 */
export const inventoryWithdrawals = pgTable(
  'inventory_withdrawals',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    partRequirementId: uuid('part_requirement_id').references(
      () => partRequirements.id,
      { onDelete: 'set null' },
    ),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    quantity: numeric('quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    withdrawnByUserId: uuid('withdrawn_by_user_id'),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...lifecycleColumns,
  },
  (table) => [
    index('inventory_withdrawals_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
  ],
);
