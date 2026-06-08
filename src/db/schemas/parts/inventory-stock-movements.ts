import { index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { inventoryMovementKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { inventoryItems } from '@/db/schemas/parts/inventory-items';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Inventory stock movement — the authoritative append-only ledger
 * (docs/03-data-model.md). Every receipt/withdrawal/return/adjustment writes a
 * signed `quantity_delta` row; the item's `quantity_on_hand` is the running
 * sum. APPEND-ONLY at the RLS level (INSERT + SELECT only) — a wrong movement
 * is corrected by a compensating movement, never an in-place edit.
 */
export const inventoryStockMovements = pgTable(
  'inventory_stock_movements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    kind: inventoryMovementKind('kind').notNull(),
    /** Signed: positive = stock in, negative = stock out. */
    quantityDelta: numeric('quantity_delta', {
      precision: 12,
      scale: 3,
    }).notNull(),
    /** What this movement is for (e.g. a withdrawal id), for the audit trail. */
    referenceId: uuid('reference_id'),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('inventory_stock_movements_item_idx').on(
      table.organizationId,
      table.inventoryItemId,
    ),
  ],
);
