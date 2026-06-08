import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  caseAcceptanceMethod,
  caseAcceptanceStatus,
  communicationChannel,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { communicationThreads } from '@/db/schemas/communication/communication-threads';
import { customers } from '@/db/schemas/customer/customers';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Case acceptance — the customer's approval to START a repair
 * (docs/03-data-model.md, full audit; this is a legal/insurer record).
 *
 * The customer is asked to approve EVERY repair start. Approval can come via:
 *   - clicking the job-card link (`job_card_link`) and accepting there,
 *   - replying OK to the SMS (`sms_reply`) / email (`email_reply`),
 *   - staff recording a verbal/in-person acceptance (`manual`).
 *
 * `token` secures the public job-card page (no login — the customer is not a
 * system user). `thread_id` links the SMS/email conversation so the chat is
 * traceable back to the approval. The case detail shows the current status so
 * staff can SEE at a glance that the customer approved.
 */
export const caseAcceptances = pgTable(
  'case_acceptances',
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
    /** The conversation this approval was requested/answered through. */
    threadId: uuid('thread_id').references(() => communicationThreads.id, {
      onDelete: 'set null',
    }),
    /** How the request was sent (sms preferred, email backup). */
    channel: communicationChannel('channel'),
    status: caseAcceptanceStatus('status').notNull().default('pending'),
    /** Opaque secret for the public job-card link. */
    token: varchar('token', { length: 64 }).notNull(),
    /** What the customer is approving (the scope / estimate summary). */
    summary: text('summary'),
    requestedByUserId: uuid('requested_by_user_id'),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** How it was answered (set on accept/decline). */
    method: caseAcceptanceMethod('method'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    /** Free text of the customer's reply (e.g. the literal "OK"). */
    responseText: text('response_text'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('case_acceptances_token_uq').on(table.token),
    index('case_acceptances_case_idx').on(
      table.organizationId,
      table.caseId,
      table.status,
    ),
  ],
);
