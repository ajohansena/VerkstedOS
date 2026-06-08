import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { checklistResponseResult } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { checklistRuns } from '@/db/schemas/quality/checklist-runs';
import { checklistTemplateItems } from '@/db/schemas/quality/checklist-template-items';
import { documents } from '@/db/schemas/documents/documents';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Checklist response — the answer to one item in a run (docs/03-data-model.md).
 * `result` pass/fail/na. When the item requires it, a `fail` must carry a
 * comment and/or a linked photo (`photo_document_id`) — enforced in the service.
 */
export const checklistResponses = pgTable(
  'checklist_responses',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    checklistRunId: uuid('checklist_run_id')
      .notNull()
      .references(() => checklistRuns.id, { onDelete: 'cascade' }),
    templateItemId: uuid('template_item_id')
      .notNull()
      .references(() => checklistTemplateItems.id, { onDelete: 'restrict' }),
    result: checklistResponseResult('result').notNull(),
    comment: text('comment'),
    /** A photo documenting a failure (when required). */
    photoDocumentId: uuid('photo_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    respondedByUserId: uuid('responded_by_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('checklist_responses_run_item_uq').on(
      table.organizationId,
      table.checklistRunId,
      table.templateItemId,
    ),
  ],
);
