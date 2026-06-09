import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { rentalAgreementStatus } from '@/db/enums';
import { organizations } from '@/db/schemas/identity/organizations';
import { rentalReservations } from './rental-reservations';

/**
 * Rental agreement — the signed contract paired with a reservation. Linked to
 * the digital-signature crypto chain (Sprint 12) by `signatureId`. Stored
 * separately so a reservation can pre-exist a signed agreement (Sprint 18).
 */
export const rentalAgreements = pgTable(
  'rental_agreements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => rentalReservations.id, { onDelete: 'cascade' }),
    status: rentalAgreementStatus('status').notNull().default('draft'),
    /** Pointer to the digital_signatures row when signed; null while draft. */
    signatureId: uuid('signature_id'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    signedByName: varchar('signed_by_name', { length: 128 }),
    terms: text('terms'),
    ...lifecycleColumns,
  },
  (table) => [
    index('rental_agreements_reservation_idx').on(
      table.organizationId,
      table.reservationId,
    ),
    index('rental_agreements_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
