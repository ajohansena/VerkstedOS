import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { checklistTemplates } from '@/db/schemas/quality/checklist-templates';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Checklist template item — a single check (docs/03-data-model.md). Examples:
 * "Lys kontrollert", "Panelspalter kontrollert". A failed item can require a
 * comment and/or a photo (`requires_comment_on_fail` / `requires_photo_on_fail`)
 * — enforced in the service when a response marks it `fail`.
 */
export const checklistTemplateItems = pgTable(
  'checklist_template_items',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sequenceNo: integer('sequence_no').notNull().default(0),
    isRequired: boolean('is_required').notNull().default(true),
    requiresCommentOnFail: boolean('requires_comment_on_fail')
      .notNull()
      .default(true),
    requiresPhotoOnFail: boolean('requires_photo_on_fail')
      .notNull()
      .default(false),
    ...lifecycleColumns,
  },
  (table) => [
    index('checklist_template_items_template_idx').on(
      table.organizationId,
      table.templateId,
    ),
  ],
);
