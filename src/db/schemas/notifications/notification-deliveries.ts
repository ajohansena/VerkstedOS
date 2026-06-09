import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { notificationChannel, notificationDeliveryStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { notifications } from '@/db/schemas/notifications/notifications';

/**
 * Notification delivery (Sprint 17). Append-mostly per-channel attempt log for
 * one notification. SMS/email adapters are env-gated (Sprint 12 pattern):
 * unconfigured → `skipped` with provider details `null`. Configured → `queued`
 * then `sent`/`failed`/`bounced` as the adapter responds.
 */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: notificationChannel('channel').notNull(),
    address: text('address').notNull(),
    status: notificationDeliveryStatus('status').notNull().default('queued'),
    providerId: text('provider_id'),
    providerStatus: text('provider_status'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('notification_deliveries_notification_idx').on(
      table.organizationId,
      table.notificationId,
    ),
    index('notification_deliveries_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);
