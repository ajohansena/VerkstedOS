import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { suppliers } from '@/db/schemas/parts/suppliers';

/**
 * Supplier agreement — negotiated terms with a supplier (docs/03-data-model.md).
 * Discount factor + lead time used when sourcing parts. Time-bounded so a new
 * agreement supersedes an old one without losing history.
 */
export const supplierAgreements = pgTable(
  'supplier_agreements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** Multiplier applied to list price (e.g. 0.65 = 35% off). */
    discountFactor: numeric('discount_factor', { precision: 6, scale: 4 }),
    leadTimeDays: numeric('lead_time_days', { precision: 5, scale: 1 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('supplier_agreements_supplier_idx').on(
      table.organizationId,
      table.supplierId,
    ),
  ],
);
