import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { caseTransferMode, caseTransferStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Case transfer — a tracked move of a case between two workshops
 * (docs/03-data-model.md, multi-location). The source initiates; the target
 * accepts (→ in_transit) and confirms arrival (→ arrived). On arrival the case's
 * active assignment + `current_workshop_id` flip to the destination. Operational
 * records (segments, time entries, photos) keep their ORIGINAL workshop_id —
 * only the case pointer moves.
 */
export const caseTransfers = pgTable(
  'case_transfers',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    fromWorkshopId: uuid('from_workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    toWorkshopId: uuid('to_workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'restrict' }),
    status: caseTransferStatus('status').notNull().default('initiated'),
    transportMode: caseTransferMode('transport_mode')
      .notNull()
      .default('drive'),
    reason: text('reason'),
    initiatedByUserId: uuid('initiated_by_user_id'),
    acceptedByUserId: uuid('accepted_by_user_id'),
    arrivedConfirmedByUserId: uuid('arrived_confirmed_by_user_id'),
    initiatedAt: timestamp('initiated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expectedArrivalAt: timestamp('expected_arrival_at', { withTimezone: true }),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_transfers_case_idx').on(table.organizationId, table.caseId),
    index('case_transfers_inbound_idx').on(
      table.organizationId,
      table.toWorkshopId,
      table.status,
    ),
  ],
);
