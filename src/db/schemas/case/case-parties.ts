import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { casePartyRole } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Case party — non-insurance third parties on a case (counterparty, witness,
 * guarantor, third-party payer, ...). docs/03-data-model.md.
 */
export const caseParties = pgTable(
  'case_parties',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    role: casePartyRole('role').notNull(),
    /** Optional link to a known customer; otherwise free-text identity. */
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    name: text('name'),
    contactInfo: text('contact_info'),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_parties_case_idx').on(table.organizationId, table.caseId),
  ],
);
