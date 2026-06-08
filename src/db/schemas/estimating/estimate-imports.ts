import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  estimateImportKind,
  estimateImportStatus,
  estimateSource,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Estimate import — the version aggregate root (ADR-004, docs/03-data-model.md).
 *
 * Each import is an IMMUTABLE versioned snapshot of a DBS takst (or manual
 * estimate). Lifecycle: draft → active → locked. A new version (supplement or
 * re-estimate) SUPERSEDES the prior one via `supersedes_id`; the prior import
 * transitions to `superseded`. Locked imports and their child lines are never
 * edited in place — corrections create a new version. This immutability is a
 * TakstKontroll-compatibility requirement (rule 4.7).
 */
export const estimateImports = pgTable(
  'estimate_imports',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    source: estimateSource('source').notNull().default('dbs'),
    kind: estimateImportKind('kind').notNull().default('original'),
    status: estimateImportStatus('status').notNull().default('draft'),
    versionNumber: integer('version_number').notNull().default(1),
    /** The import this version replaces (supplement / re-estimate chain). */
    supersedesId: uuid('supersedes_id'),
    /** DBS source identifiers (for dedupe + traceability). */
    oppdragsId: text('oppdrags_id'),
    skadenr: text('skadenr'),
    /** When the version was locked (immutable from this point). */
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedByUserId: uuid('locked_by_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    index('estimate_imports_case_idx').on(table.organizationId, table.caseId),
    index('estimate_imports_oppdrags_idx').on(table.oppdragsId),
  ],
);
