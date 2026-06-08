import {
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Inventory item — a stocked part at a workshop (docs/03-data-model.md).
 * `quantity_on_hand` is the running balance maintained by stock movements (the
 * authoritative ledger). One row per part-number per workshop.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    partNumber: varchar('part_number', { length: 64 }).notNull(),
    description: text('description').notNull(),
    quantityOnHand: numeric('quantity_on_hand', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    /** Cost basis for withdrawals (weighted average is out of MVP scope). */
    unitCost: numeric('unit_cost', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('inventory_items_org_workshop_part_uq').on(
      table.organizationId,
      table.workshopId,
      table.partNumber,
    ),
  ],
);
