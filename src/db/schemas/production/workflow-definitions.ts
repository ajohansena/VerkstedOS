import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Workflow definition — workflow is DATA, per org, versioned (ADR-006,
 * docs/10-production-domain.md). The system ships a default Norwegian
 * collision-repair workflow; orgs may customize. Each org has one active
 * definition; older versions are retained so historical cases resolve their
 * original state names.
 *
 * GUARDRAIL (Sprint 8): workflow states are NOT the source of production truth.
 * They are a configurable, human-readable projection layer over the real
 * execution (segments + clock activity, Sprint 10). The transition machine
 * updates a projection; it does not own production reality.
 */
export const workflowDefinitions = pgTable(
  'workflow_definitions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    versionNumber: integer('version_number').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    ...lifecycleColumns,
  },
  (table) => [index('workflow_definitions_org_idx').on(table.organizationId)],
);
