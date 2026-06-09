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

import { invoiceBasisKind, invoiceBasisStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { customers } from '@/db/schemas/customer/customers';
import { insuranceCompanies } from '@/db/schemas/platform/insurance-companies';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Invoice basis header (docs/03-data-model.md, Sprint 15).
 *
 * One InvoiceBasis per active funding source per case — the "fakturagrunnlag"
 * that becomes an external invoice (insurance / private / warranty) or an
 * internal cost record (goodwill / internal_rework). A deductible (egenandel)
 * is carved out as its OWN basis (kind=`deductible`) to the deductible payer.
 *
 * Totals (net / vat / gross) are stored projections recomputed from the lines
 * by the canonical `calculateInvoiceBasisTotals` (SSoT). The payer is snapshot
 * here so the basis stays correct even if the funding source changes later.
 *
 * TakstKontroll (CLAUDE.md § 4.7): every basis stays attributable to its case +
 * funding source; internal cost (goodwill / rework) is a SEPARATE kind that
 * never mixes with externally-invoiced amounts.
 */
export const invoiceBasis = pgTable(
  'invoice_basis',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    fundingSourceId: uuid('funding_source_id')
      .notNull()
      .references(() => caseFundingSources.id, { onDelete: 'restrict' }),
    /** For a deductible basis: the insurance funding source it was carved from. */
    deductibleOfFundingSourceId: uuid(
      'deductible_of_funding_source_id',
    ).references(() => caseFundingSources.id, { onDelete: 'set null' }),
    basisNumber: varchar('basis_number', { length: 32 }).notNull(),
    kind: invoiceBasisKind('kind').notNull().default('standard'),
    /** Snapshot of the payer type at generation time. */
    payerType: varchar('payer_type', { length: 32 }).notNull(),
    payerCustomerId: uuid('payer_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    payerInsuranceId: uuid('payer_insurance_id').references(
      () => insuranceCompanies.id,
      { onDelete: 'set null' },
    ),
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
    status: invoiceBasisStatus('status').notNull().default('draft'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id'),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('invoice_basis_org_number_uq').on(
      table.organizationId,
      table.basisNumber,
    ),
    index('invoice_basis_case_idx').on(table.organizationId, table.caseId),
    index('invoice_basis_status_idx').on(table.organizationId, table.status),
  ],
);
