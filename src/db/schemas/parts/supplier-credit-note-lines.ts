import { index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { organizations } from '@/db/schemas/identity/organizations';
import { supplierCreditNotes } from '@/db/schemas/parts/supplier-credit-notes';
import { supplierInvoiceLines } from '@/db/schemas/parts/supplier-invoice-lines';

/**
 * Supplier credit note line (Sprint 14 Track F).
 *
 * Mirrors the invoice line. Optionally references the original invoice line it
 * reverses (so the matched quantity can net out) plus the case + funding source
 * to keep the credit attributable per TakstKontroll (§ 4.7).
 */
export const supplierCreditNoteLines = pgTable(
  'supplier_credit_note_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierCreditNoteId: uuid('supplier_credit_note_id')
      .notNull()
      .references(() => supplierCreditNotes.id, { onDelete: 'cascade' }),
    supplierInvoiceLineId: uuid('supplier_invoice_line_id').references(
      () => supplierInvoiceLines.id,
      { onDelete: 'set null' },
    ),
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    description: text('description'),
    quantity: numeric('quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    unitPriceNet: numeric('unit_price_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    lineNet: numeric('line_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    ...lifecycleColumns,
  },
  (table) => [
    index('supplier_credit_note_lines_note_idx').on(
      table.organizationId,
      table.supplierCreditNoteId,
    ),
  ],
);
