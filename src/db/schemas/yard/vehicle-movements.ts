import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { vehicleMovementReason } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { yardLocations } from '@/db/schemas/yard/yard-locations';

/**
 * Vehicle movement — APPEND-ONLY history of every yard placement change.
 * One row per move (from → to). `fromLocationId` is NULL on the first
 * placement (initial arrival). Append-only is enforced by the RLS policy
 * (INSERT + SELECT only — no UPDATE/DELETE policies).
 * (Sprint 19)
 */
export const vehicleMovements = pgTable(
  'vehicle_movements',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    fromLocationId: uuid('from_location_id').references(
      () => yardLocations.id,
      { onDelete: 'set null' },
    ),
    toLocationId: uuid('to_location_id')
      .notNull()
      .references(() => yardLocations.id, { onDelete: 'restrict' }),
    reason: vehicleMovementReason('reason').notNull().default('reposition'),
    movedAt: timestamp('moved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    movedByUserId: uuid('moved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('vehicle_movements_case_idx').on(table.caseId),
    index('vehicle_movements_org_idx').on(table.organizationId),
    index('vehicle_movements_to_idx').on(table.toLocationId),
  ],
);
