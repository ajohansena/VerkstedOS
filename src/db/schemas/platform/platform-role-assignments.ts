import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { platformRole } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { platformUsers } from '@/db/schemas/platform/platform-users';

/**
 * Platform role assignments (docs/06-developer-control-plane.md). Roles are
 * assigned by other platform owners only. Revocable (revoked_at).
 *
 * Sprint 20 (Platform Maturity): the `PlatformOwner` role is a singleton —
 * at most one active row, enforced by a partial unique index
 * (`platform_role_assignments_one_active_owner_idx`, migration 0048).
 */
export const platformRoleAssignments = pgTable(
  'platform_role_assignments',
  {
    id: idColumn,
    platformUserId: uuid('platform_user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    role: platformRole('role').notNull(),
    grantedByUserId: uuid('granted_by_user_id'),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    reason: text('reason'),
  },
  (table) => ({
    oneActiveOwner: uniqueIndex(
      'platform_role_assignments_one_active_owner_idx',
    )
      .on(table.role)
      .where(sql`${table.role} = 'PlatformOwner' AND ${table.revokedAt} IS NULL`),
  }),
);

