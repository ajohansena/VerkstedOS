import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { insuranceClaimStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { insuranceCompanies } from '@/db/schemas/platform/insurance-companies';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Insurance claim (docs/03-data-model.md). Org-scoped; links to the
 * platform-shared `insurance_companies` catalog. A claim funds a case via a
 * `case_funding_sources` row of kind `insurance`.
 */
export const insuranceClaims = pgTable(
  'insurance_claims',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** The insurer's claim number (krav-/skadenummer). */
    claimNumber: varchar('claim_number', { length: 64 }),
    insuranceCompanyId: uuid('insurance_company_id').references(
      () => insuranceCompanies.id,
      { onDelete: 'set null' },
    ),
    status: insuranceClaimStatus('status').notNull().default('open'),
    /** Approved coverage amount + currency (paired per money convention). */
    coverageAmount: numeric('coverage_amount', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    ...lifecycleColumns,
  },
  (table) => [
    index('insurance_claims_org_idx').on(table.organizationId),
    index('insurance_claims_claim_number_idx').on(
      table.organizationId,
      table.claimNumber,
    ),
  ],
);
