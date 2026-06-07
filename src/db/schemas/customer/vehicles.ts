import {
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { ownershipType } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Vehicle — org-scoped, with separate legal OWNER and primary USER
 * (docs/03-data-model.md). Supports private, leasing, and company-pool
 * scenarios without conflating who owns the car with who drives it.
 */
export const vehicles = pgTable(
  'vehicles',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    registrationNumber: varchar('registration_number', { length: 16 }),
    vin: varchar('vin', { length: 32 }),
    make: text('make'),
    model: text('model'),
    year: integer('year'),
    colour: text('colour'),
    /** Legal owner (e.g. DNB Leasing). Nullable until known. */
    ownerCustomerId: uuid('owner_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    /** Primary user / driver (e.g. Ola Hansen). Nullable until known. */
    userCustomerId: uuid('user_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    ownershipType: ownershipType('ownership_type').notNull().default('unknown'),
    leaseContractRef: text('lease_contract_ref'),
    ...lifecycleColumns,
  },
  (table) => [
    index('vehicles_org_reg_idx').on(
      table.organizationId,
      table.registrationNumber,
    ),
    index('vehicles_owner_idx').on(table.ownerCustomerId),
    index('vehicles_user_idx').on(table.userCustomerId),
  ],
);
