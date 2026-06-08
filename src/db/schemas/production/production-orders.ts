import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';

/**
 * Production order — the CONTAINER aggregate, 1:1 with a Case
 * (docs/10-production-domain.md, Sprint 8 guardrail).
 *
 * It is NOT a state machine and NOT the source of production truth. It holds:
 *   - which workflow definition this case runs against (pinned at creation, so
 *     historical cases keep their workflow version)
 *   - `current_state_id` — a PROJECTION of the latest state transition (the
 *     append-only `production_state_history` is the authoritative log; this is a
 *     denormalized pointer for fast reads)
 *
 * In Sprint 10, WorkSegment + clock activity become the primary driver: segment
 * events trigger transitions that update this projection. Until then, manual
 * transitions update it. Either way, `current_state_id` is derived, never the
 * hand-maintained source of truth.
 */
export const productionOrders = pgTable(
  'production_orders',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    workflowDefinitionId: uuid('workflow_definition_id')
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: 'restrict' }),
    /** PROJECTION of the latest transition; authoritative log is state_history. */
    currentStateId: uuid('current_state_id').references(
      () => workflowStates.id,
      {
        onDelete: 'set null',
      },
    ),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ...lifecycleColumns,
  },
  (table) => [
    unique('production_orders_case_uq').on(table.caseId),
    index('production_orders_org_state_idx').on(
      table.organizationId,
      table.currentStateId,
    ),
  ],
);
