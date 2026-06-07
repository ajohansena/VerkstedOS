import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { caseStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Case — the operational root (docs/03-data-model.md, ADR-013). ORG-SCOPED, not
 * workshop-scoped: the case can move between workshops while keeping one
 * timeline. `current_workshop_id` is a denormalization derived from the active
 * CaseAssignment (introduced in Sprint 13); writable now for single-site flow.
 *
 * `incident_tag` covers the deferred DamageEvent (ADR-014). `parent_case_id`
 * links warranty/rework cases back to the original.
 */
export const cases = pgTable(
  'cases',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Unique per org (custom format per org). */
    caseNumber: varchar('case_number', { length: 32 }).notNull(),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'set null',
    }),
    primaryCustomerId: uuid('primary_customer_id').references(
      () => customers.id,
      { onDelete: 'set null' },
    ),
    incidentTag: text('incident_tag'),
    currentWorkshopId: uuid('current_workshop_id').references(
      () => workshops.id,
      { onDelete: 'set null' },
    ),
    status: caseStatus('status').notNull().default('intake'),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    parentCaseId: uuid('parent_case_id'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('cases_org_number_uq').on(
      table.organizationId,
      table.caseNumber,
    ),
    index('cases_org_status_idx').on(table.organizationId, table.status),
    index('cases_vehicle_idx').on(table.vehicleId),
    index('cases_customer_idx').on(table.primaryCustomerId),
  ],
);
