import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  officeTaskKind,
  officeTaskPriority,
  officeTaskStatus,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { workshops } from '@/db/schemas/identity/workshops';
import { resources } from '@/db/schemas/workforce/resources';

/**
 * Office task — the "planner-as-heart" complement to `work_segments` (doc 13
 * § 10 + § 16.1; CLAUDE.md § 4.4 — workflow is data).
 *
 * Office tasks are non-billable, capacity-FREE work that the planner needs to
 * surface alongside production segments: "order parts", "ring kunde dagen før",
 * "klargjør faktura", "bestill leiebil". They are NOT consumed by the capacity
 * engine (see capacity.ts unit tests) and are NEVER aggregated into case cost
 * (TakstKontroll compatibility — CLAUDE.md § 4.7).
 *
 * Assignment rule: exactly ONE of `assignee_resource_id` / `assignee_user_id`
 * is set (resource for planned-resource-bound tasks; user for office staff who
 * are not modeled as Resources). Enforced by CHECK constraint.
 *
 * Most tasks are case-linked but not all — "ukentlig forsikringsavstemming" has
 * no case. Likewise some tasks are not workshop-scoped.
 *
 * Provenance: `generated_by_event_type` + `generated_from_event_id` (D3 Phase F)
 * give per-event idempotency for the template-driven generator.
 */
export const officeTasks = pgTable(
  'office_tasks',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    kind: officeTaskKind('kind').notNull().default('other'),
    priority: officeTaskPriority('priority').notNull().default('normal'),
    status: officeTaskStatus('status').notNull().default('open'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    assigneeResourceId: uuid('assignee_resource_id').references(
      () => resources.id,
      { onDelete: 'set null' },
    ),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Provenance — for auto-generated tasks. Phase F. */
    generatedByEventType: text('generated_by_event_type'),
    generatedFromEventId: uuid('generated_from_event_id'),
    generatedFromTemplateId: uuid('generated_from_template_id'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelledReason: text('cancelled_reason'),
    ...lifecycleColumns,
  },
  (table) => [
    index('office_tasks_org_status_idx').on(
      table.organizationId,
      table.status,
      table.dueAt,
    ),
    index('office_tasks_case_idx').on(table.organizationId, table.caseId),
    index('office_tasks_assignee_user_idx').on(
      table.organizationId,
      table.assigneeUserId,
      table.status,
    ),
    index('office_tasks_assignee_resource_idx').on(
      table.organizationId,
      table.assigneeResourceId,
      table.status,
    ),
    index('office_tasks_workshop_due_idx').on(
      table.organizationId,
      table.workshopId,
      table.dueAt,
    ),
    // Exactly one of resource / user assignee, or neither (unassigned). Not both.
    check(
      'office_tasks_single_assignee_chk',
      sql`(${table.assigneeResourceId} IS NULL) OR (${table.assigneeUserId} IS NULL)`,
    ),
  ],
);
