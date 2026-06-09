import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  notificationCategory,
  notificationSeverity,
  notificationStatus,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import { users } from '@/db/schemas/identity/users';

/**
 * Notification (Sprint 17). A single notification item routed to one recipient.
 *
 * Created by the notification engine OR by an event consumer. Dedup is via
 * (org, rule_code, ref_type, ref_id, recipient_id) so re-evaluating the same
 * rule doesn't spam — the engine UPSERTs and the existing row's `seen_at`
 * advances.
 *
 * `payload` carries i18n-ready context (e.g. `{caseNumber, days}`) used by the
 * UI to render the localized message; `body` is a pre-rendered fallback.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'cascade',
    }),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The rule that produced this notification, if any. Null for ad-hoc events. */
    ruleCode: varchar('rule_code', { length: 64 }),
    category: notificationCategory('category').notNull(),
    severity: notificationSeverity('severity').notNull(),
    /** Entity kind this notification is about (e.g. `case`, `part_requirement`). */
    refType: varchar('ref_type', { length: 32 }).notNull(),
    refId: uuid('ref_id'),
    /** Title key under `i18n.notifications.titles`, e.g. `parts_delay`. */
    titleKey: varchar('title_key', { length: 64 }).notNull(),
    /** Pre-rendered fallback body in the org's primary locale. */
    body: text('body').notNull(),
    payload: jsonb('payload').notNull().default({}),
    /** Deep link the UI should open. */
    actionUrl: text('action_url'),
    status: notificationStatus('status').notNull().default('unread'),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    // Dedup index. ref_id may be null (org-wide notification), in which case
    // we allow multiples by relying on the rule code's natural keying.
    uniqueIndex('notifications_dedup_uq').on(
      table.organizationId,
      table.recipientUserId,
      table.ruleCode,
      table.refType,
      table.refId,
    ),
    index('notifications_recipient_status_idx').on(
      table.organizationId,
      table.recipientUserId,
      table.status,
    ),
    index('notifications_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);
