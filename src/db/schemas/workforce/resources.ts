import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { resourceKind, resourceStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Resource — capacity unit for planning (docs/10-production-domain.md § Resource
 * model). Resources are people, equipment, AND facilities — equipment (paint
 * booth, frame bench, ADAS rig) and facilities are first-class because in
 * collision repair they are often more constrained than labor.
 *
 * A `person` resource links to an employee. Equipment/facility resources have no
 * employee link. Capacity planning (Sprint 10) computes against resources.
 */
export const resources = pgTable(
  'resources',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Workshop-scoped by default; null = shared across the org (e.g. a chain rig). */
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    kind: resourceKind('kind').notNull(),
    name: text('name').notNull(),
    status: resourceStatus('status').notNull().default('active'),
    /** Link to an employee when kind='person'. */
    employeeId: uuid('employee_id').references(() => employees.id, {
      onDelete: 'set null',
    }),
    /** Equipment/facility kind hint (e.g. 'paint_booth', 'frame_bench'). */
    metadata: jsonb('metadata'),
    ...lifecycleColumns,
  },
  (table) => [
    index('resources_org_workshop_kind_idx').on(
      table.organizationId,
      table.workshopId,
      table.kind,
    ),
  ],
);
