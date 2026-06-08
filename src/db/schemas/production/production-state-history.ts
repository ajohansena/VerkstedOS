import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { workflowTransitionTrigger } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { productionOrders } from '@/db/schemas/production/production-orders';

/**
 * Production state history — the APPEND-ONLY authoritative log of state
 * transitions (audit tier: event, docs/10-production-domain.md). The row IS the
 * record; `production_orders.current_state_id` is merely a projection of the
 * latest row here.
 *
 * GUARDRAIL: this log — driven by manual transitions now, segment/clock events
 * in Sprint 10 — is the source of truth for how a case's status evolved, not the
 * scalar on the case.
 */
export const productionStateHistory = pgTable(
  'production_state_history',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    productionOrderId: uuid('production_order_id')
      .notNull()
      .references(() => productionOrders.id, { onDelete: 'cascade' }),
    /** Null on the initial state entry. */
    fromStateId: uuid('from_state_id'),
    toStateId: uuid('to_state_id').notNull(),
    /** What drove this transition. */
    trigger: workflowTransitionTrigger('trigger').notNull().default('manual'),
    /** The event type, when event_driven (e.g. production.segment.completed). */
    triggerEventType: text('trigger_event_type'),
    reason: text('reason'),
    actorUserId: uuid('actor_user_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    correlationId: varchar('correlation_id', { length: 64 }),
  },
  (table) => [
    index('production_state_history_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
    index('production_state_history_order_idx').on(table.productionOrderId),
  ],
);
