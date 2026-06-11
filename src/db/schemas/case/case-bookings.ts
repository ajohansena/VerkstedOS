import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { caseBookingStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Case booking — the customer-facing scheduling commitment for a case
 * (docs/10-production-domain.md § Booking; doc 13 § 20.4). Holds the
 * promised arrival + delivery times the operator quotes the customer.
 *
 * One ACTIVE booking per case at a time (enforced by partial unique index on
 * status IN ('tentative','confirmed','arrived')). Re-bookings supersede via
 * cancel-and-create — full history is retained.
 *
 * The booking is workshop-scoped (which yard the customer is arriving at). For
 * multi-location cases (Sprint 13), a new booking row is created per arrival.
 *
 * Distinct from `case_transfers.expected_arrival_at` which tracks inter-workshop
 * ETAs; bookings own first-arrival + delivery commitments.
 *
 * NOT a funding source, NOT a quality artifact. Pure scheduling.
 */
export const caseBookings = pgTable(
  'case_bookings',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'restrict' }),
    status: caseBookingStatus('status').notNull().default('tentative'),
    expectedArrivalAt: timestamp('expected_arrival_at', {
      withTimezone: true,
    }),
    promisedDeliveryAt: timestamp('promised_delivery_at', {
      withTimezone: true,
    }),
    notes: text('notes'),
    cancelledReason: text('cancelled_reason'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedByUserId: uuid('confirmed_by_user_id'),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    arrivedConfirmedByUserId: uuid('arrived_confirmed_by_user_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_bookings_case_idx').on(
      table.organizationId,
      table.caseId,
      table.status,
    ),
    index('case_bookings_workshop_arrival_idx').on(
      table.organizationId,
      table.workshopId,
      table.expectedArrivalAt,
    ),
    // At most one ACTIVE booking per case — re-bookings cancel-and-create.
    uniqueIndex('case_bookings_one_active_per_case_uq')
      .on(table.caseId)
      .where(sql`status in ('tentative','confirmed','arrived')`),
  ],
);
