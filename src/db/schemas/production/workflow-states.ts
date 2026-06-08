import {
  boolean,
  index,
  integer,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';

import { workflowStateCategory } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';

/**
 * Workflow state — a named state within a workflow definition. The `category`
 * (active / waiting / terminal) drives behavior (clock counting, board placement,
 * notifications) — see docs/10-production-domain.md § State categories. `code`
 * is a stable key; `label` is the org-configurable display name.
 */
export const workflowStates = pgTable(
  'workflow_states',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workflowDefinitionId: uuid('workflow_definition_id')
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    label: text('label').notNull(),
    category: workflowStateCategory('category').notNull(),
    sequenceNo: integer('sequence_no').notNull().default(0),
    /** Display colour hint for the board (red/yellow/green semantics). */
    colorHint: varchar('color_hint', { length: 16 }),
    isInitial: boolean('is_initial').notNull().default(false),
    ...lifecycleColumns,
  },
  (table) => [
    unique('workflow_states_def_code_uq').on(
      table.workflowDefinitionId,
      table.code,
    ),
    index('workflow_states_def_idx').on(table.workflowDefinitionId),
  ],
);
