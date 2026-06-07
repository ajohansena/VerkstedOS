import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { ownershipType } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';
import { vehicles } from '@/db/schemas/customer/vehicles';

/**
 * Vehicle ownership history (append-only, audit tier: event).
 *
 * Records each owner/user assignment over a vehicle's lifetime so the legal
 * owner and primary user at any past point can be reconstructed (insurance and
 * leasing scenarios depend on this). A new row is written whenever a vehicle's
 * owner, user, or ownership type changes; the row itself IS the audit record.
 */
export const vehicleOwnershipHistory = pgTable(
  'vehicle_ownership_history',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    ownerCustomerId: uuid('owner_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    userCustomerId: uuid('user_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    ownershipType: ownershipType('ownership_type').notNull().default('unknown'),
    /** When this ownership state began. */
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    recordedByUserId: uuid('recorded_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('vehicle_ownership_history_vehicle_idx').on(
      table.organizationId,
      table.vehicleId,
    ),
  ],
);
