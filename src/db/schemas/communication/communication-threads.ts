import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { communicationChannel, communicationThreadStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Communication thread — a conversation with a customer about a case
 * (docs/03-data-model.md). One thread per (case, channel, contact). SMS and
 * email both flow through threads so the full back-and-forth is stored and
 * TRACEABLE (the acceptance SMS chat lives here). `contact_value` is the phone
 * number or email the messages go to/from.
 */
export const communicationThreads = pgTable(
  'communication_threads',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    channel: communicationChannel('channel').notNull(),
    /** The phone number (sms) or email address (email). */
    contactValue: varchar('contact_value', { length: 256 }).notNull(),
    subject: text('subject'),
    status: communicationThreadStatus('status').notNull().default('open'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('communication_threads_case_idx').on(
      table.organizationId,
      table.caseId,
    ),
    index('communication_threads_contact_idx').on(
      table.organizationId,
      table.channel,
      table.contactValue,
    ),
  ],
);
