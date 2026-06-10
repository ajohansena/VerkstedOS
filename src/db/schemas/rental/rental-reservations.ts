import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { rentalReservationStatus } from '@/db/enums';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';
import { rentalVehicles } from './rental-vehicles';

/**
 * Rental reservation — a planned/active loan of a `rental_vehicle` to a
 * customer, normally linked to a `case_funding_source` so the insurer (or
 * the customer's own pocket) settles the rental cost (Sprint 18).
 */
export const rentalReservations = pgTable(
  'rental_reservations',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    rentalVehicleId: uuid('rental_vehicle_id')
      .notNull()
      .references(() => rentalVehicles.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id').references(() => cases.id, {
      onDelete: 'set null',
    }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    fundingSourceId: uuid('funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: rentalReservationStatus('status').notNull().default('planned'),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    index('rental_reservations_vehicle_idx').on(
      table.organizationId,
      table.rentalVehicleId,
      table.startsAt,
    ),
    index('rental_reservations_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
    index('rental_reservations_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
