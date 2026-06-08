import { index, numeric, pgTable, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { partReceipts } from '@/db/schemas/parts/part-receipts';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';

/**
 * Part receipt line — quantity received against one PO line
 * (docs/03-data-model.md). Drives the PO line's quantity_received and the part
 * requirement's status toward received/fulfilled.
 */
export const partReceiptLines = pgTable(
  'part_receipt_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    partReceiptId: uuid('part_receipt_id')
      .notNull()
      .references(() => partReceipts.id, { onDelete: 'cascade' }),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLines.id, { onDelete: 'restrict' }),
    partRequirementId: uuid('part_requirement_id').references(
      () => partRequirements.id,
      { onDelete: 'set null' },
    ),
    quantityReceived: numeric('quantity_received', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    ...lifecycleColumns,
  },
  (table) => [
    index('part_receipt_lines_receipt_idx').on(
      table.organizationId,
      table.partReceiptId,
    ),
  ],
);
