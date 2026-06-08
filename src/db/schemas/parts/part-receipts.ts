import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { purchaseOrders } from '@/db/schemas/parts/purchase-orders';

/**
 * Part receipt header — a delivery against a purchase order
 * (docs/03-data-model.md). One PO can be received in several deliveries.
 */
export const partReceipts = pgTable(
  'part_receipts',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    receivedByUserId: uuid('received_by_user_id'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('part_receipts_po_idx').on(
      table.organizationId,
      table.purchaseOrderId,
    ),
  ],
);
