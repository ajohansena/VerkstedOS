import {
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { supplierStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Supplier — parts vendor master data (docs/03-data-model.md, Parts spine).
 * Org-scoped. A supplier supplies parts via purchase orders; agreements hold
 * the negotiated discount and lead time.
 */
export const suppliers = pgTable(
  'suppliers',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    orgNumber: varchar('org_number', { length: 16 }),
    contactEmail: text('contact_email'),
    contactPhone: varchar('contact_phone', { length: 32 }),
    status: supplierStatus('status').notNull().default('active'),
    /** Fallback lead time when no agreement specifies one. */
    defaultLeadTimeDays: numeric('default_lead_time_days', {
      precision: 5,
      scale: 1,
    }),
    ...lifecycleColumns,
  },
  (table) => [
    index('suppliers_org_idx').on(table.organizationId, table.status),
  ],
);
