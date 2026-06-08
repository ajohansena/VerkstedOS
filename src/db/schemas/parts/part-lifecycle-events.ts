import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { partLifecycleEventKind } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { partRequirements } from '@/db/schemas/parts/part-requirements';

/**
 * Part lifecycle event — the append-only timeline projection the UI consumes
 * (docs/03-data-model.md). Every meaningful step (created, ordered, received,
 * withdrawn, returned, fulfilled) appends one row per part requirement. This is
 * the human-readable history, distinct from the financial reconciliation
 * projection. APPEND-ONLY at the RLS level (INSERT + SELECT only).
 *
 * It carries NO created_by/updated_at lifecycle columns — it is a derived,
 * immutable event log keyed by `occurred_at`.
 */
export const partLifecycleEvents = pgTable(
  'part_lifecycle_events',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    partRequirementId: uuid('part_requirement_id')
      .notNull()
      .references(() => partRequirements.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    kind: partLifecycleEventKind('kind').notNull(),
    /** Free-form context (quantities, PO number, supplier, reason). */
    detail: jsonb('detail'),
    actorUserId: uuid('actor_user_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('part_lifecycle_events_requirement_idx').on(
      table.organizationId,
      table.partRequirementId,
      table.occurredAt,
    ),
  ],
);
