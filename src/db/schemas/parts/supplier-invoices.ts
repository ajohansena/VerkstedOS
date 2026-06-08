import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { supplierInvoiceStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { suppliers } from '@/db/schemas/parts/suppliers';

/**
 * Supplier invoice header (docs/03-data-model.md, Sprint 14 Track F).
 *
 * A single supplier invoice can span SEVERAL cases — the lines carry the
 * case + funding-source traceability so TakstKontroll (CLAUDE.md § 4.7) stays
 * intact: estimated vs actually-billed quantities never collapse into a single
 * "done" flag, and every billed line remains attributable to a case.
 *
 * `status` is the lifecycle: draft → booked → matched (and/or credited). It is
 * a stored projection; the authoritative line-level reconciliation is computed
 * by `calculateInvoiceMatch` (the registered SSoT metric).
 */
export const supplierInvoices = pgTable(
  'supplier_invoices',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    /** Gross total as printed on the invoice (incl. VAT). */
    totalGross: numeric('total_gross', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    status: supplierInvoiceStatus('status').notNull().default('draft'),
    bookedAt: timestamp('booked_at', { withTimezone: true }),
    bookedByUserId: uuid('booked_by_user_id'),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    // An invoice number is unique per supplier within an org.
    uniqueIndex('supplier_invoices_org_supplier_number_uq').on(
      table.organizationId,
      table.supplierId,
      table.invoiceNumber,
    ),
    index('supplier_invoices_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
