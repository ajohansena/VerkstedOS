import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { partReturnStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { suppliers } from '@/db/schemas/parts/suppliers';

/**
 * Part return header — parts sent back to a supplier (docs/03-data-model.md).
 * Lines link back to the PO line they reverse; a supplier credit note settles
 * the financial side (Sprint 13 finance). Status tracks shipped → credited.
 */
export const partReturns = pgTable(
  'part_returns',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    returnNumber: text('return_number'),
    status: partReturnStatus('status').notNull().default('requested'),
    initiatedByUserId: uuid('initiated_by_user_id'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('part_returns_supplier_idx').on(
      table.organizationId,
      table.supplierId,
      table.status,
    ),
  ],
);
