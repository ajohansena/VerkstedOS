import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { checklistTemplateKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Checklist template — a QC checklist definition (docs/03-data-model.md).
 * Per-workshop configurable: `workshop_id` null = org-wide default, set = a
 * workshop-specific variant. Examples: delivery checklist, ADAS-calibration
 * checklist. Items live in `checklist_template_items`.
 */
export const checklistTemplates = pgTable(
  'checklist_templates',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Null = org-wide; set = a workshop-specific variant. */
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    kind: checklistTemplateKind('kind').notNull().default('general'),
    isActive: boolean('is_active').notNull().default(true),
    versionNumber: integer('version_number').notNull().default(1),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('checklist_templates_org_workshop_code_uq').on(
      table.organizationId,
      table.workshopId,
      table.code,
    ),
    index('checklist_templates_org_idx').on(
      table.organizationId,
      table.isActive,
    ),
  ],
);
