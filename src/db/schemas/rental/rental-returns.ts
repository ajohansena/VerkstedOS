import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { rentalAgreements } from './rental-agreements';

/**
 * Rental return — recorded at handover-back: odometer, fuel level, any damage
 * notes. Settles the agreement (Sprint 18).
 */
export const rentalReturns = pgTable(
  'rental_returns',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => rentalAgreements.id, { onDelete: 'cascade' }),
    returnedAt: timestamp('returned_at', { withTimezone: true }).notNull(),
    odometerKm: integer('odometer_km'),
    /** 0..100 representing the percentage of fuel remaining. */
    fuelLevelPercent: integer('fuel_level_percent'),
    damageNotes: text('damage_notes'),
    /** Extra charges (NOK). */
    additionalChargesAmount: numeric('additional_charges_amount', {
      precision: 12,
      scale: 2,
    }),
    ...lifecycleColumns,
  },
  (table) => [
    index('rental_returns_agreement_idx').on(
      table.organizationId,
      table.agreementId,
    ),
  ],
);
