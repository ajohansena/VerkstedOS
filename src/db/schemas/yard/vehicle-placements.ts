import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { yardLocations } from '@/db/schemas/yard/yard-locations';

/**
 * Vehicle placement — the *current* yard location for a case's vehicle.
 * UNIQUE per case (one active row per case); history lives in
 * `vehicle_movements`. Updating placement is achieved by a service that
 * UPDATEs this row AND appends a `vehicle_movements` row in the same txn.
 * (Sprint 19)
 */
export const vehiclePlacements = pgTable(
  'vehicle_placements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => yardLocations.id, { onDelete: 'restrict' }),
    placedAt: timestamp('placed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text('note'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('vehicle_placements_case_uq').on(table.caseId),
    index('vehicle_placements_location_idx').on(table.locationId),
    index('vehicle_placements_org_idx').on(table.organizationId),
  ],
);
