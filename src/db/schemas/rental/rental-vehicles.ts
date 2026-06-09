import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { rentalVehicleStatus } from '@/db/enums';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Rental vehicle — a courtesy/loaner car owned (or managed) by a workshop and
 * lent to a customer while their own vehicle is in repair (Sprint 18).
 * Insurance often pays via the case's funding source (`rental_reservations.funding_source_id`).
 */
export const rentalVehicles = pgTable(
  'rental_vehicles',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    registrationNumber: varchar('registration_number', { length: 16 }).notNull(),
    make: varchar('make', { length: 64 }),
    model: varchar('model', { length: 64 }),
    /** Daily rental rate in NOK (numeric(12,2)). */
    dailyRate: numeric('daily_rate', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    status: rentalVehicleStatus('status').notNull().default('available'),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('rental_vehicles_org_regno_uq').on(
      table.organizationId,
      table.registrationNumber,
    ),
    index('rental_vehicles_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
