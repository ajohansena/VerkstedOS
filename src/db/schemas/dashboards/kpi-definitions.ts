import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { kpiDirection, kpiUnit } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * KPI definition (docs/11-dashboards.md, Sprint 16) — the per-org catalog of
 * key metrics a dashboard can display. Each definition names the canonical
 * calculation (the metric registry `code`) that produces it, the unit, the
 * good-direction for traffic-lighting, and an optional target. The dashboards
 * and the nightly snapshot job both resolve values through the SAME registered
 * calculation — the definition is metadata, never a second implementation.
 */
export const kpiDefinitions = pgTable(
  'kpi_definitions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Stable key, e.g. `cycle_time`, `on_time_rate`. */
    code: varchar('code', { length: 64 }).notNull(),
    label: text('label').notNull(),
    /** The metric-registry metric this KPI is computed from. */
    metricCode: varchar('metric_code', { length: 64 }).notNull(),
    unit: kpiUnit('unit').notNull(),
    direction: kpiDirection('direction').notNull().default('up'),
    /** Target value (interpreted in `unit`); null = no target set. */
    targetValue: numeric('target_value', { precision: 14, scale: 2 }),
    /** Higher-level grouping for the dashboard, e.g. `production`, `finance`. */
    category: varchar('category', { length: 32 }).notNull().default('general'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('kpi_definitions_org_code_uq').on(
      table.organizationId,
      table.code,
    ),
    index('kpi_definitions_org_category_idx').on(
      table.organizationId,
      table.category,
    ),
  ],
);
