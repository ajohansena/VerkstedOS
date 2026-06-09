import {
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { kpiPeriod } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * KPI snapshot (docs/11-dashboards.md, Sprint 16) — a computed value of one KPI
 * for one org (optionally one workshop) over one period. Written by the nightly
 * Inngest job from the canonical calculations and read by dashboards for the
 * "as of" figure and by the Executive sparklines as a time-series.
 *
 * Append-mostly: one row per (org, workshop, kpi, period, periodStart). The
 * job UPSERTs the latest computed value for a period so a re-run corrects
 * rather than duplicates; the `computedAt` records when.
 */
export const kpiSnapshots = pgTable(
  'kpi_snapshots',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Null = org-wide (chain) snapshot; set = per-workshop. */
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'cascade',
    }),
    kpiCode: varchar('kpi_code', { length: 64 }).notNull(),
    period: kpiPeriod('period').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    value: numeric('value', { precision: 14, scale: 2 }).notNull(),
    /** Sample size behind the value (e.g. cases counted), for transparency. */
    sampleSize: numeric('sample_size', { precision: 12, scale: 0 }),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...lifecycleColumns,
  },
  (table) => [
    // The unique key uses NULLS NOT DISTINCT in the migration DDL so org-wide
    // snapshots (workshop_id IS NULL) still collide on re-run and UPSERT rather
    // than duplicate. The drizzle index builder in this version can't express
    // NULLS NOT DISTINCT, so it lives in the hand-checked migration SQL.
    uniqueIndex('kpi_snapshots_unique').on(
      table.organizationId,
      table.workshopId,
      table.kpiCode,
      table.period,
      table.periodStart,
    ),
    index('kpi_snapshots_series_idx').on(
      table.organizationId,
      table.kpiCode,
      table.periodStart,
    ),
  ],
);
