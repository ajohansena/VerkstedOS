import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { fundingSourceKind, fundingSourceStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { customers } from '@/db/schemas/customer/customers';
import { insuranceClaims } from '@/db/schemas/case/insurance-claims';
import { insuranceCompanies } from '@/db/schemas/platform/insurance-companies';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Case funding source — THE distinctive VerkstedOS model (docs/03-data-model.md,
 * ADR-013). Multiple payers on one repair visit: insurance claims, deductibles,
 * private pay, internal rework — all on the same case.
 *
 * Per-kind behavior is enforced in the service layer:
 *   - insurance:        links an insurance_claim; insurer pays + optional deductible
 *   - private_pay:      payer_customer_id pays
 *   - warranty:         manufacturer pays; references_case_id back-link
 *   - goodwill:         workshop absorbs (internal cost, no external invoice)
 *   - internal_rework:  workshop absorbs; rework_reason + references_case_id required
 */
export const caseFundingSources = pgTable(
  'case_funding_sources',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull().default(1),
    kind: fundingSourceKind('kind').notNull(),
    label: text('label').notNull(),
    insuranceClaimId: uuid('insurance_claim_id').references(
      () => insuranceClaims.id,
      { onDelete: 'set null' },
    ),
    /** Who gets the invoice (private_pay / warranty / deductible). */
    payerCustomerId: uuid('payer_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    /** Insurer paying directly (kind=insurance). */
    payerInsuranceId: uuid('payer_insurance_id').references(
      () => insuranceCompanies.id,
      { onDelete: 'set null' },
    ),
    deductibleAmount: numeric('deductible_amount', { precision: 14, scale: 2 }),
    deductiblePayerCustomerId: uuid('deductible_payer_customer_id').references(
      () => customers.id,
      { onDelete: 'set null' },
    ),
    coverageCapAmount: numeric('coverage_cap_amount', {
      precision: 14,
      scale: 2,
    }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    status: fundingSourceStatus('status').notNull().default('draft'),
    /** For warranty/rework: the case this references. */
    referencesCaseId: uuid('references_case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    /** Required when kind=internal_rework. */
    reworkReason: text('rework_reason'),
    /** Which workshop absorbs the cost (goodwill / internal_rework). */
    reworkOwnerWorkshopId: uuid('rework_owner_workshop_id').references(
      () => workshops.id,
      { onDelete: 'set null' },
    ),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_funding_sources_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
  ],
);
