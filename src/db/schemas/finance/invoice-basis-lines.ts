import { index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { invoiceBasisLineKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { invoiceBasis } from '@/db/schemas/finance/invoice-basis';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Invoice basis line (Sprint 15).
 *
 * One billable line on an invoice basis. VAT is applied PER LINE (CLAUDE.md
 * money rule) so mixed-rate baskets stay correct: `lineNet` × `vatRate` =
 * `lineVat`, and `lineGross` = `lineNet` + `lineVat`. `sourceRef` keeps the
 * estimate/supplier-line provenance for the TakstKontroll chain.
 */
export const invoiceBasisLines = pgTable(
  'invoice_basis_lines',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    invoiceBasisId: uuid('invoice_basis_id')
      .notNull()
      .references(() => invoiceBasis.id, { onDelete: 'cascade' }),
    /** Denormalized for case-level traceability without a join. */
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    lineKind: invoiceBasisLineKind('line_kind').notNull().default('other'),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 })
      .notNull()
      .default('1'),
    unitPriceNet: numeric('unit_price_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('25'),
    lineNet: numeric('line_net', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    lineVat: numeric('line_vat', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    lineGross: numeric('line_gross', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    /** Provenance: estimate operation/part id or supplier invoice line id. */
    sourceRef: text('source_ref'),
    ...lifecycleColumns,
  },
  (table) => [
    index('invoice_basis_lines_basis_idx').on(
      table.organizationId,
      table.invoiceBasisId,
    ),
    index('invoice_basis_lines_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
  ],
);
