import {
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Shift definition — a working-hours template per workshop
 * (docs/03-data-model.md). Drives capacity calendars (Sprint 10). Times are
 * minutes-from-midnight (workshop-local); `weekday_mask` is a 7-bit set
 * (Mon..Sun) of active days.
 */
export const shiftDefinitions = pgTable(
  'shift_definitions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Minutes from midnight, workshop-local. */
    startMinute: integer('start_minute').notNull().default(420), // 07:00
    endMinute: integer('end_minute').notNull().default(900), // 15:00
    breakMinutes: integer('break_minutes').notNull().default(30),
    /** Bitmask Mon=1..Sun=64; default Mon–Fri = 31. */
    weekdayMask: integer('weekday_mask').notNull().default(31),
    timezone: varchar('timezone', { length: 48 })
      .notNull()
      .default('Europe/Oslo'),
    ...lifecycleColumns,
  },
  (table) => [
    index('shift_definitions_workshop_idx').on(
      table.organizationId,
      table.workshopId,
    ),
  ],
);
