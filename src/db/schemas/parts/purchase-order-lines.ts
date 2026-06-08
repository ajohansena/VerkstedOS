import {
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { purchaseOrderLineStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { purchaseOrders } from '@/db/schemas/parts/purchase-orders';

/**
 * Purchase order line (docs/03-data-model.md). Each line satisfies one part
 * requirement on one case — this is the link that preserves case-level
 * traceability even though the PO header spans many cases. `case_id` and
 * `funding_source_id` are denormalized onto the line for clean reconciliation
 * without joining back through the requirement (TakstKontroll, § 4.7).
 */
export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    partRequirementId: uuid('part_requirement_id').references(
      () => partRequirements.id,
      { onDelete: 'set null' },
    ),
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    partNumber: varchar('part_number', { length: 64 }),
    description: text('description').notNull(),
    quantityOrdered: numeric('quantity_ordered', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    quantityReceived: numeric('quantity_received', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    unitPrice: numeric('unit_price', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    status: purchaseOrderLineStatus('status').notNull().default('open'),
    ...lifecycleColumns,
  },
  (table) => [
    index('purchase_order_lines_po_idx').on(
      table.organizationId,
      table.purchaseOrderId,
    ),
    index('purchase_order_lines_requirement_idx').on(
      table.organizationId,
      table.partRequirementId,
    ),
  ],
);
