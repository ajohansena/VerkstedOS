import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { workflowTransitionTrigger } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';

/**
 * Workflow transition — an allowed move from one state to another
 * (docs/10-production-domain.md). `trigger` is manual / automatic /
 * event_driven. `event_type` names the driving event when event_driven (e.g.
 * `production.segment.completed` — the Sprint 10 driver). `required_permissions`
 * and `required_conditions` gate the move; `side_effects` configures emissions.
 *
 * GUARDRAIL: event_driven transitions are how WorkSegment/clock activity will
 * drive the status projection in Sprint 10. They are first-class here so the
 * wiring slots in without reworking the model.
 */
export const workflowTransitions = pgTable(
  'workflow_transitions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workflowDefinitionId: uuid('workflow_definition_id')
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
    fromStateId: uuid('from_state_id')
      .notNull()
      .references(() => workflowStates.id, { onDelete: 'cascade' }),
    toStateId: uuid('to_state_id')
      .notNull()
      .references(() => workflowStates.id, { onDelete: 'cascade' }),
    trigger: workflowTransitionTrigger('trigger').notNull().default('manual'),
    /** Event type that drives an event_driven transition. */
    eventType: text('event_type'),
    /** Permission codes required to perform a manual transition. */
    requiredPermissions: jsonb('required_permissions'),
    /** Conditions that must hold (e.g. all_segments_complete). */
    requiredConditions: jsonb('required_conditions'),
    /** Side effects to apply (emit_notification, generate_invoice_basis, ...). */
    sideEffects: jsonb('side_effects'),
    ...lifecycleColumns,
  },
  (table) => [
    index('workflow_transitions_def_idx').on(table.workflowDefinitionId),
    index('workflow_transitions_from_idx').on(table.fromStateId),
  ],
);
