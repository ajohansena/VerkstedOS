import {
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { idColumn } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { resources } from '@/db/schemas/workforce/resources';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Capacity forecast snapshot — a per-resource, per-day projection of available
 * vs committed minutes (docs/10-production-domain.md § Capacity engine). A
 * read-model (audit tier: none) rebuilt from resource assignments + calendars by
 * the capacity engine; cached for fast dashboard queries.
 */
export const capacityForecastSnapshots = pgTable(
  'capacity_forecast_snapshots',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    forecastDate: date('forecast_date').notNull(),
    totalMinutes: integer('total_minutes').notNull().default(0),
    committedMinutes: integer('committed_minutes').notNull().default(0),
    availableMinutes: integer('available_minutes').notNull().default(0),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('capacity_snapshots_resource_date_idx').on(
      table.organizationId,
      table.resourceId,
      table.forecastDate,
    ),
  ],
);
