import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { segmentDependencyKind } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workSegments } from '@/db/schemas/production/work-segments';

/**
 * Work segment dependency — prerequisite chains between segments
 * (docs/10-production-domain.md). Most are `must_complete_before` (you can't
 * paint a panel that isn't body-repaired). The forecast/planner respects these.
 */
export const workSegmentDependencies = pgTable(
  'work_segment_dependencies',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** The dependent segment. */
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => workSegments.id, { onDelete: 'cascade' }),
    /** The prerequisite segment. */
    prerequisiteSegmentId: uuid('prerequisite_segment_id')
      .notNull()
      .references(() => workSegments.id, { onDelete: 'cascade' }),
    dependencyKind: segmentDependencyKind('dependency_kind')
      .notNull()
      .default('must_complete_before'),
  },
  (table) => [
    unique('work_segment_deps_uq').on(
      table.segmentId,
      table.prerequisiteSegmentId,
    ),
    index('work_segment_deps_org_idx').on(table.organizationId),
  ],
);
