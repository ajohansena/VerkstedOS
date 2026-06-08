import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { purchaseOrderStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { suppliers } from '@/db/schemas/parts/suppliers';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Purchase order header (docs/03-data-model.md, Parts spine). ONE PO can span
 * MANY cases — its lines link to per-case part requirements. This is why the PO
 * is NOT case-scoped: aggregating at the PO loses nothing because traceability
 * lives on the line → requirement link (CLAUDE.md § 4.7).
 */
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    /** Workshop that raised the PO (where parts are delivered). */
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    poNumber: varchar('po_number', { length: 32 }).notNull(),
    status: purchaseOrderStatus('status').notNull().default('draft'),
    orderedByUserId: uuid('ordered_by_user_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    expectedDeliveryAt: timestamp('expected_delivery_at', {
      withTimezone: true,
    }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('purchase_orders_org_number_uq').on(
      table.organizationId,
      table.poNumber,
    ),
    index('purchase_orders_supplier_idx').on(
      table.organizationId,
      table.supplierId,
      table.status,
    ),
  ],
);
