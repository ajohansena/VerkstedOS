import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn } from '@/db/schemas/_shared';

/**
 * Feature flag — a Dev-Control-Plane toggle (docs/06-developer-control-plane.md).
 * Platform-managed (no per-tenant RLS; written only via the service-role Dev
 * plane and read in-app through a helper). `organization_id` null = a global
 * default; a row with an org id overrides the default for that org.
 */
export const featureFlags = pgTable(
  'feature_flags',
  {
    id: idColumn,
    /** Null = global default; set = per-org override. */
    organizationId: uuid('organization_id'),
    key: varchar('key', { length: 64 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    description: text('description'),
    metadata: jsonb('metadata'),
    updatedByPlatformUserId: uuid('updated_by_platform_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('feature_flags_org_key_uq').on(table.organizationId, table.key),
    index('feature_flags_key_idx').on(table.key),
  ],
);
