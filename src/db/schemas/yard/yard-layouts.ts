import {
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Yard layout — a configurable physical area at a workshop where vehicles
 * are parked while in process (intake yard, paint booth bays, storage row).
 * One workshop can have many layouts (e.g. front yard + back yard + paint hall).
 * (Sprint 19; docs/13-production-board-v3.md "Where is the car?")
 */
export const yardLayouts = pgTable(
  'yard_layouts',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    /** Short org-unique code (e.g. "FRONT", "PAINT-HALL"). */
    code: varchar('code', { length: 32 }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('yard_layouts_org_code_uq').on(
      table.organizationId,
      table.code,
    ),
    index('yard_layouts_workshop_idx').on(table.workshopId),
  ],
);
