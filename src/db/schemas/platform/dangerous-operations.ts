import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { dangerousOperationKind, dangerousOperationStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';

/**
 * Dangerous operations queue (Sprint 20). A platform-level surface that
 * captures destructive or operationally-critical actions and requires a
 * SECOND user to approve before execution (the "two-person rule"). The row
 * is the audit trail: requestor, requested-at, payload, approver, approved-at,
 * executed-at, outcome.
 *
 * `organizationId` is the target org of the action; `requestedByUserId` and
 * `approvedByUserId` MUST be distinct (enforced in the service, not the
 * schema — the platform admins live in `users` without an org foreign-key).
 */
export const dangerousOperations = pgTable(
  'dangerous_operations',
  {
    id: idColumn,
    /** Target organization (null only for true platform-wide ops). */
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    kind: dangerousOperationKind('kind').notNull(),
    status: dangerousOperationStatus('status')
      .notNull()
      .default('pending_approval'),
    /** Free-form structured payload describing what will happen. */
    payload: jsonb('payload').notNull().default({}),
    /** Why the requestor needs this (mandatory operational justification). */
    reason: text('reason').notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    /** Result message captured after execution (success or failure detail). */
    outcome: text('outcome'),
    ...lifecycleColumns,
  },
  (table) => [
    index('dangerous_operations_status_idx').on(table.status),
    index('dangerous_operations_org_idx').on(table.organizationId),
  ],
);
