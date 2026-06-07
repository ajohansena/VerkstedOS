import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { userStatus } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';

/**
 * User — a global identity (docs/03-data-model.md). Platform-scoped: a user is
 * not owned by an organization; the User↔Org link is the `memberships` table.
 *
 * The primary key equals the Supabase Auth user id (`auth.users.id`); this
 * table augments auth with app-level profile and status. There is therefore no
 * default UUID — the id is supplied from the auth record.
 */
export const users = pgTable(
  'users',
  {
    id: idColumn,
    email: text('email').notNull(),
    fullName: text('full_name'),
    status: userStatus('status').notNull().default('active'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('users_email_uq').on(table.email)],
);
