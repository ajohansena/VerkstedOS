import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Case note — free-text notes on a case (docs/03-data-model.md). Part of the
 * case timeline foundation; the full timeline aggregates notes, state history,
 * communications, etc. in later sprints.
 */
export const caseNotes = pgTable(
  'case_notes',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    ...lifecycleColumns,
  },
  (table) => [
    index('case_notes_case_idx').on(table.organizationId, table.caseId),
  ],
);
