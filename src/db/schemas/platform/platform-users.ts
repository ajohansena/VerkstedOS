import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { platformUserStatus } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { users } from '@/db/schemas/identity/users';

/**
 * Platform users — the separate identity track for the Developer Control Plane
 * (docs/06-developer-control-plane.md). A user with NO row here cannot access
 * `/dev` at all (middleware returns 404). Same auth identity as `users`, a
 * different authorization track — no customer-org role can grant platform access.
 */
export const platformUsers = pgTable(
  'platform_users',
  {
    id: idColumn,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: platformUserStatus('status').notNull().default('active'),
    addedByUserId: uuid('added_by_user_id'),
    notes: text('notes'),
    /** Whether 2FA has been enrolled (mandatory for platform users). */
    twoFactorEnrolledAt: timestamp('two_factor_enrolled_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('platform_users_user_uq').on(table.userId)],
);
