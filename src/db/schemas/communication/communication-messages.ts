import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  communicationChannel,
  communicationDirection,
  communicationMessageStatus,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { communicationThreads } from '@/db/schemas/communication/communication-threads';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Communication message — one SMS/email in a thread (docs/03-data-model.md,
 * event-tier append-only). Stores BOTH directions: outbound (we send) and
 * inbound (customer replies, e.g. "OK"). The row IS the record — this is the
 * traceable chat. `provider_message_id` correlates with the gateway; `status`
 * tracks queued → sent → delivered (or received for inbound). When no SMS/email
 * provider is configured yet, outbound messages are stored as `queued` so they
 * are not lost and can be flushed when the API is wired.
 */
export const communicationMessages = pgTable(
  'communication_messages',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => communicationThreads.id, { onDelete: 'cascade' }),
    direction: communicationDirection('direction').notNull(),
    channel: communicationChannel('channel').notNull(),
    body: text('body').notNull(),
    status: communicationMessageStatus('status').notNull().default('queued'),
    /** Gateway message id, when sent/received through a provider. */
    providerMessageId: varchar('provider_message_id', { length: 128 }),
    /** Staff member who sent an outbound message (null for inbound/system). */
    sentByUserId: uuid('sent_by_user_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...lifecycleColumns,
  },
  (table) => [
    index('communication_messages_thread_idx').on(
      table.organizationId,
      table.threadId,
      table.occurredAt,
    ),
  ],
);
