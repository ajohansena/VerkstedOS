import { index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { organizations } from '@/db/schemas/identity/organizations';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import { supplierInvoices } from '@/db/schemas/parts/supplier-invoices';

/**
 * Supplier invoice line (Sprint 14 Track F).
 *
 * The traceability spine: each billed line optionally links to the case, the
 * funding source it should be charged to, the purchase-order line it fulfils,
 * and the part requirement. All FOUR links are NULLABLE so an invoice line can
 * be entered before it is matched — but once matched they preserve the
 * estimate → order → receipt → invoice chain per TakstKontroll (§ 4.7).
 */
export const supplierInvoiceLines = pgTable(
  'supplier_invoice_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierInvoiceId: uuid('supplier_invoice_id')
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    purchaseOrderLineId: uuid('purchase_order_line_id').references(
      () => purchaseOrderLines.id,
      { onDelete: 'set null' },
    ),
    partRequirementId: uuid('part_requirement_id').references(
      () => partRequirements.id,
      { onDelete: 'set null' },
    ),
    description: text('description'),
    quantity: numeric('quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    /** Net unit price excl. VAT. */
    unitPriceNet: numeric('unit_price_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    /** Line net total excl. VAT (quantity × unitPriceNet, stored). */
    lineNet: numeric('line_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    ...lifecycleColumns,
  },
  (table) => [
    index('supplier_invoice_lines_invoice_idx').on(
      table.organizationId,
      table.supplierInvoiceId,
    ),
    index('supplier_invoice_lines_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
  ],
);
