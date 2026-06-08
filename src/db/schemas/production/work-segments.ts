import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { workSegmentStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import { productionOrders } from '@/db/schemas/production/production-orders';
import { workshopDepartments } from '@/db/schemas/identity/workshop-departments';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Work segment — THE planning unit (docs/10-production-domain.md). A segment is
 * DECOMPOSED WORK, not a status. Departments, skills, and equipment line up at
 * the segment level; the planner schedules against segments.
 *
 * GUARDRAIL (Sprint 10 activation): a segment's `status` is driven by ACTUAL
 * work activity — a technician clocking into the segment moves it to
 * `in_progress`; completion drives the case's status PROJECTION via the
 * transition machine. `actual_minutes` is computed from time entries; segments
 * are created per case (from the estimate) so small repairs skip stages and
 * large repairs add them.
 */
export const workSegments = pgTable(
  'work_segments',
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
    /** Catalog code, e.g. 'paint_preparation'. */
    segmentCode: varchar('segment_code', { length: 64 }).notNull(),
    label: text('label').notNull(),
    sequenceNo: integer('sequence_no').notNull().default(0),
    plannedWorkshopId: uuid('planned_workshop_id').references(
      () => workshops.id,
      { onDelete: 'set null' },
    ),
    plannedDepartmentId: uuid('planned_department_id').references(
      () => workshopDepartments.id,
      { onDelete: 'set null' },
    ),
    /** Skill codes required (array). */
    requiredSkills: jsonb('required_skills'),
    /** Equipment kinds required (array, e.g. ['paint_booth']). */
    requiredEquipmentKinds: jsonb('required_equipment_kinds'),
    /** Planned labor minutes (derived from estimate periods via periodsToHours). */
    plannedMinutes: integer('planned_minutes').notNull().default(0),
    /** Computed from time entries. */
    actualMinutes: integer('actual_minutes').notNull().default(0),
    remainingMinutesEstimate: integer('remaining_minutes_estimate'),
    status: workSegmentStatus('status').notNull().default('not_started'),
    blockedReason: text('blocked_reason'),
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
    actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
    /** Technician's time inherits this funding source. */
    defaultFundingSourceId: uuid('default_funding_source_id').references(
      () => caseFundingSources.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    index('work_segments_case_idx').on(table.organizationId, table.caseId),
    index('work_segments_order_idx').on(table.productionOrderId),
    index('work_segments_status_idx').on(table.organizationId, table.status),
  ],
);
