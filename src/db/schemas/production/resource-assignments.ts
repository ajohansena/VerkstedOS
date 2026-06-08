import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { resourceAssignmentRole, resourceAssignmentStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { resources } from '@/db/schemas/workforce/resources';
import { workSegments } from '@/db/schemas/production/work-segments';

/**
 * Resource assignment — plans a resource (person / equipment / facility) onto a
 * work segment for a time block (docs/10-production-domain.md). A segment can
 * have multiple assignments (two body techs in parallel; painter + booth +
 * helper). Conflicts are surfaced, never silently overwritten — the planner
 * checks for overlapping confirmed assignments on the same resource.
 *
 * `actual_start_at` / `actual_end_at` derive from clock events (Sprint 9/10).
 */
export const resourceAssignments = pgTable(
  'resource_assignments',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workSegmentId: uuid('work_segment_id')
      .notNull()
      .references(() => workSegments.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    role: resourceAssignmentRole('role').notNull().default('primary'),
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
    actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
    status: resourceAssignmentStatus('status').notNull().default('planned'),
    conflictResolvedAt: timestamp('conflict_resolved_at', {
      withTimezone: true,
    }),
    conflictOverrideByUserId: uuid('conflict_override_by_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    index('resource_assignments_segment_idx').on(
      table.organizationId,
      table.workSegmentId,
    ),
    index('resource_assignments_resource_idx').on(
      table.resourceId,
      table.plannedStartAt,
    ),
  ],
);
