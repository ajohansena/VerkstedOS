import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  officeTaskKind,
  officeTaskPriority,
  taskTemplateDueReference,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { workshops } from '@/db/schemas/identity/workshops';
import { resources } from '@/db/schemas/workforce/resources';

/**
 * Task template — the event-driven generator that closes doc 13 § 16.1.
 *
 * A template is "when this event fires, create this kind of office task with
 * this offset". The Inngest function `generate-office-tasks-from-events`
 * scans the outbox and produces tasks via `createOfficeTask`, carrying the
 * source event id forward into `office_tasks.generated_from_event_id` for
 * idempotency.
 *
 * Idempotency is enforced at the office_tasks side via the partial unique
 * index `office_tasks_template_event_unique` created in migration 0054 —
 * (generated_from_template_id, generated_from_event_id) where both not null.
 *
 * Filter semantics: `triggerEventFilter` is a shallow JSON match against
 * `outbox_events.payload`. e.g. `{toStateCode: 'delivered'}` matches when
 * `payload.toStateCode === 'delivered'`. The evaluator only supports flat key
 * equality — anything more complex stays in code for now.
 */
export const taskTemplates = pgTable(
  'task_templates',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    triggerEventType: text('trigger_event_type').notNull(),
    triggerEventFilter: jsonb('trigger_event_filter'),
    taskKind: officeTaskKind('task_kind').notNull(),
    taskTitleTemplate: text('task_title_template').notNull(),
    taskDescriptionTemplate: text('task_description_template'),
    /**
     * Minutes added (positive = after, negative = before) to the reference
     * timestamp resolved via `dueReference`. e.g. −14400 = 10 days before
     * the reference; +60 = 1 hour after.
     */
    dueOffsetMinutes: integer('due_offset_minutes').notNull().default(0),
    dueReference: taskTemplateDueReference('due_reference')
      .notNull()
      .default('event_time'),
    defaultAssigneeResourceId: uuid('default_assignee_resource_id').references(
      () => resources.id,
      { onDelete: 'set null' },
    ),
    defaultAssigneeUserId: uuid('default_assignee_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    defaultPriority: officeTaskPriority('default_priority')
      .notNull()
      .default('normal'),
    isActive: boolean('is_active').notNull().default(true),
    ...lifecycleColumns,
  },
  (table) => [
    index('task_templates_org_event_idx').on(
      table.organizationId,
      table.triggerEventType,
      table.isActive,
    ),
  ],
);
