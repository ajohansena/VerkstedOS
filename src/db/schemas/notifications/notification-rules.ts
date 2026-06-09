import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  notificationCategory,
  notificationChannel,
  notificationSeverity,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Notification rule (docs/09-roadmap.md Sprint 17, docs/13 § 16.1 note).
 *
 * Configurable per-org trigger that the notification engine evaluates on a
 * cron. The rule's `code` (e.g. `parts_delay_3d`) maps 1:1 to a detector
 * function in `src/modules/notifications/application/calculations/triggers.ts`.
 * Org admins enable/disable, tune `params` (jsonb), and choose channels.
 * Permission: `admin:config` (no new permission — discipline rule).
 */
export const notificationRules = pgTable(
  'notification_rules',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    category: notificationCategory('category').notNull(),
    severity: notificationSeverity('severity').notNull().default('warning'),
    label: text('label').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    /** Channels this rule sends through. Always includes 'in_app'. */
    channels: notificationChannel('channels').array().notNull(),
    /** Detector parameters (e.g. `{thresholdDays: 3}`). Shape per-detector. */
    params: jsonb('params').notNull().default({}),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('notification_rules_org_code_uq').on(
      table.organizationId,
      table.code,
    ),
    index('notification_rules_org_enabled_idx').on(
      table.organizationId,
      table.enabled,
    ),
  ],
);
