import {
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate part — a spare part from the DBS "Reservedelsspesifikasjon". Each
 * carries the DBS part number (delenummer), name, list price (listepris), a
 * price-adjustment/discount factor code, and the line amount (beløp). Immutable
 * once the import is locked.
 */
export const estimateParts = pgTable(
  'estimate_parts',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    estimateImportId: uuid('estimate_import_id')
      .notNull()
      .references(() => estimateImports.id, { onDelete: 'cascade' }),
    /** DBS part number (delenummer), e.g. '9831194480'. */
    partNumber: varchar('part_number', { length: 64 }),
    description: text('description').notNull(),
    listPrice: numeric('list_price', { precision: 14, scale: 2 }),
    /** DBS price-adjustment/discount factor codes as printed (e.g. '1,6'). */
    discountFactor: varchar('discount_factor', { length: 32 }),
    amount: numeric('amount', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    index('estimate_parts_import_idx').on(
      table.organizationId,
      table.estimateImportId,
    ),
  ],
);
