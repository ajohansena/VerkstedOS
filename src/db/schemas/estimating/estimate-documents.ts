import {
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate document — the parsed header of a DBS takst (one per import version).
 * Immutable once the import is locked. Captures everything observable in the
 * estimate's "Sammenstilling" header: vehicle, insurer, owner, dates.
 * (docs/reference/dbs — EN64251 example.)
 */
export const estimateDocuments = pgTable('estimate_documents', {
  id: idColumn,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  estimateImportId: uuid('estimate_import_id')
    .notNull()
    .references(() => estimateImports.id, { onDelete: 'cascade' }),
  /** Estimate/report number, e.g. 'EN64251'. */
  estimateNumber: varchar('estimate_number', { length: 64 }),
  workOrderNumber: varchar('work_order_number', { length: 64 }),
  /** Insurer recipient name as printed (e.g. 'Gjensidige, Øst'). */
  insurerName: text('insurer_name'),
  /** Vehicle owner name as printed (e.g. 'Dnb Bank ASA'). */
  ownerName: text('owner_name'),
  /** Damage type, e.g. 'Kasko'. */
  damageType: varchar('damage_type', { length: 64 }),
  /** Object group, e.g. 'Personbil/ stasjonsvogn'. */
  objectGroup: text('object_group'),
  /** Vehicle description line, e.g. 'CITROEN E-C4 KOMBI-KUPE 5D'. */
  vehicleDescription: text('vehicle_description'),
  vin: varchar('vin', { length: 32 }),
  registrationNumber: varchar('registration_number', { length: 16 }),
  mileageKm: integer('mileage_km'),
  colourCode: varchar('colour_code', { length: 64 }),
  /** Normal repair time in days as estimated by DBS. */
  normalRepairDays: integer('normal_repair_days'),
  /** Key dates from the estimate, kept as ISO strings in a bag for fidelity. */
  dates: jsonb('dates'),
  workshopRef: text('workshop_ref'),
  ...lifecycleColumns,
});
