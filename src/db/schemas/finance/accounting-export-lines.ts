import { index, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { accountingExports } from '@/db/schemas/finance/accounting-exports';
import { invoiceBasis } from '@/db/schemas/finance/invoice-basis';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Accounting export line (Sprint 15) — one invoice basis included in an export,
 * with the amounts SNAPSHOT at send time. Immutable: the snapshot is what the
 * accounting system actually received, independent of later edits to the basis.
 */
export const accountingExportLines = pgTable(
  'accounting_export_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    accountingExportId: uuid('accounting_export_id')
      .notNull()
      .references(() => accountingExports.id, { onDelete: 'cascade' }),
    invoiceBasisId: uuid('invoice_basis_id')
      .notNull()
      .references(() => invoiceBasis.id, { onDelete: 'restrict' }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    netAmount: numeric('net_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    vatAmount: numeric('vat_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    grossAmount: numeric('gross_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    /** Per-line reference returned by the accounting system, if any. */
    externalLineRef: text('external_line_ref'),
    ...lifecycleColumns,
  },
  (table) => [
    index('accounting_export_lines_export_idx').on(
      table.organizationId,
      table.accountingExportId,
    ),
  ],
);
