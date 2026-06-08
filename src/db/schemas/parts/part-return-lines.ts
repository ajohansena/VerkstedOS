import { index, numeric, pgTable, uuid } from 'drizzle-orm/pg-core';

import { partReturnReason } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { partReturns } from '@/db/schemas/parts/part-returns';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';

/**
 * Part return line — quantity returned, linked back to the PO line it reverses
 * (docs/03-data-model.md). Re-opens the part requirement for re-sourcing when
 * the reason is wrong_part/damaged/defective.
 */
export const partReturnLines = pgTable(
  'part_return_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    partReturnId: uuid('part_return_id')
      .notNull()
      .references(() => partReturns.id, { onDelete: 'cascade' }),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLines.id, { onDelete: 'restrict' }),
    partRequirementId: uuid('part_requirement_id').references(
      () => partRequirements.id,
      { onDelete: 'set null' },
    ),
    quantityReturned: numeric('quantity_returned', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    reason: partReturnReason('reason').notNull(),
    ...lifecycleColumns,
  },
  (table) => [
    index('part_return_lines_return_idx').on(
      table.organizationId,
      table.partReturnId,
    ),
  ],
);
