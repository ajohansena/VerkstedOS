import { boolean, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { notificationCategory, notificationChannel } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';

/**
 * Per-user notification preferences (Sprint 17). Opt-in/out by category and
 * channel. Default behavior (when no row exists) is: in_app=on, sms=off,
 * email=off. The engine consults this before queuing deliveries.
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: notificationCategory('category').notNull(),
    channel: notificationChannel('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('notification_preferences_uq').on(
      table.organizationId,
      table.userId,
      table.category,
      table.channel,
    ),
  ],
);
