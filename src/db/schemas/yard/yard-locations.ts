import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { yardLocationKind, yardLocationStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { yardLayouts } from '@/db/schemas/yard/yard-layouts';

/**
 * Yard location — a specific labelled spot inside a layout (parking spot,
 * paint booth bay, storage rack slot). Has a logical (rowIndex, columnIndex)
 * coordinate for the map visual. Capacity defaults to 1 (one vehicle per spot)
 * but storage rows may set higher.
 * (Sprint 19)
 */
export const yardLocations = pgTable(
  'yard_locations',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    layoutId: uuid('layout_id')
      .notNull()
      .references(() => yardLayouts.id, { onDelete: 'cascade' }),
    /** Short label shown on the spot (e.g. "A12", "P3", "BAY-2"). */
    code: varchar('code', { length: 16 }).notNull(),
    kind: yardLocationKind('kind').notNull().default('parking'),
    status: yardLocationStatus('status').notNull().default('available'),
    capacity: integer('capacity').notNull().default(1),
    rowIndex: integer('row_index').notNull().default(0),
    columnIndex: integer('column_index').notNull().default(0),
    /** Optional QR tag printed/stuck to the spot. */
    qrTag: varchar('qr_tag', { length: 64 }),
    notes: text('notes'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('yard_locations_layout_code_uq').on(table.layoutId, table.code),
    uniqueIndex('yard_locations_org_qr_uq').on(
      table.organizationId,
      table.qrTag,
    ),
    index('yard_locations_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
