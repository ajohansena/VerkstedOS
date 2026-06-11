import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { aiModelProvider, aiModelStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';

/**
 * AI model registry (Sprint 21, docs/09-roadmap.md "AI foundation
 * infrastructure"). Platform-level (no per-org RLS) — every model version
 * VerkstedOS ships against is registered here so predictions can carry a
 * stable `(key, version)` pointer and the Dev plane can monitor latency /
 * cost / accuracy retrospectively.
 *
 * `key` is the stable feature identifier (e.g. `delay_risk`, `eta_estimate`).
 * `version` is the semver / model-tag string. The pair is unique.
 */
export const aiModelVersions = pgTable(
  'ai_model_versions',
  {
    id: idColumn,
    key: varchar('key', { length: 64 }).notNull(),
    version: varchar('version', { length: 64 }).notNull(),
    provider: aiModelProvider('provider').notNull(),
    status: aiModelStatus('status').notNull().default('shadow'),
    description: text('description'),
    /** Free-form configuration (endpoint, model name, hyperparams). */
    config: jsonb('config').notNull().default({}),
    registeredByPlatformUserId: uuid('registered_by_platform_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('ai_model_versions_key_version_uq').on(
      table.key,
      table.version,
    ),
    index('ai_model_versions_status_idx').on(table.status),
  ],
);
