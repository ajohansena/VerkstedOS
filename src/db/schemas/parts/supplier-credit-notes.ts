import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { supplierCreditNoteReason } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { supplierInvoices } from '@/db/schemas/parts/supplier-invoices';

/**
 * Supplier credit note header (Sprint 14 Track F).
 *
 * A reversal against a supplier invoice — returns, price corrections, or
 * over-billing. Links back to the originating invoice so the net billed
 * position per case can be computed (invoice lines − credit lines).
 */
export const supplierCreditNotes = pgTable(
  'supplier_credit_notes',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierInvoiceId: uuid('supplier_invoice_id')
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: 'cascade' }),
    creditNoteNumber: varchar('credit_note_number', { length: 64 }).notNull(),
    creditNoteDate: timestamp('credit_note_date', {
      withTimezone: true,
    }).notNull(),
    reason: supplierCreditNoteReason('reason').notNull().default('other'),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    totalGross: numeric('total_gross', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    index('supplier_credit_notes_invoice_idx').on(
      table.organizationId,
      table.supplierInvoiceId,
    ),
  ],
);
