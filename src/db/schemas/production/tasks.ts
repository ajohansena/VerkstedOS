import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { taskStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workSegments } from '@/db/schemas/production/work-segments';

/**
 * Task — optional finer-grained decomposition INSIDE a work segment
 * (docs/10-production-domain.md). "What I'm doing right now." Many segments are
 * not split into tasks; tasks exist for granular time tracking + the technician
 * queue. The segment remains the planning unit.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workSegmentId: uuid('work_segment_id')
      .notNull()
      .references(() => workSegments.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sequenceNo: integer('sequence_no').notNull().default(0),
    plannedMinutes: integer('planned_minutes').notNull().default(0),
    status: taskStatus('status').notNull().default('not_started'),
    ...lifecycleColumns,
  },
  (table) => [
    index('tasks_segment_idx').on(table.organizationId, table.workSegmentId),
  ],
);
