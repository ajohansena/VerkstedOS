import { integer, numeric, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate totals — the DBS "Sammenstilling" summary (one per import version).
 * Labor times in PERIODS (100 = 1 hour); money as numeric + currency. Immutable
 * once the import is locked. These are the headline numbers the booking system
 * reads (total labor hours drive scheduling; totals drive invoicing).
 */
export const estimateTotals = pgTable('estimate_totals', {
  id: idColumn,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  estimateImportId: uuid('estimate_import_id')
    .notNull()
    .references(() => estimateImports.id, { onDelete: 'cascade' }),

  bodyLaborPeriods: integer('body_labor_periods').notNull().default(0),
  bodyLaborAmount: numeric('body_labor_amount', { precision: 14, scale: 2 }),
  panelBeatingPeriods: integer('panel_beating_periods').notNull().default(0),
  rustProtectionPeriods: integer('rust_protection_periods')
    .notNull()
    .default(0),
  paintLaborPeriods: integer('paint_labor_periods').notNull().default(0),
  paintLaborAmount: numeric('paint_labor_amount', { precision: 14, scale: 2 }),
  paintMaterialAmount: numeric('paint_material_amount', {
    precision: 14,
    scale: 2,
  }),
  partsAmount: numeric('parts_amount', { precision: 14, scale: 2 }),
  externalWorkAmount: numeric('external_work_amount', {
    precision: 14,
    scale: 2,
  }),

  sumExVat: numeric('sum_ex_vat', { precision: 14, scale: 2 }),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }),
  vatAmount: numeric('vat_amount', { precision: 14, scale: 2 }),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
  /** Fixed-price agreement (Fastprisavtale), when present. */
  fixedPriceAgreement: numeric('fixed_price_agreement', {
    precision: 14,
    scale: 2,
  }),
  currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
  ...lifecycleColumns,
});
