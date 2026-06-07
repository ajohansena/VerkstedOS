import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { platformRole } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { platformUsers } from '@/db/schemas/platform/platform-users';

/**
 * Platform role assignments (docs/06-developer-control-plane.md). Roles are
 * assigned by other platform owners only. Revocable (revoked_at).
 */
export const platformRoleAssignments = pgTable('platform_role_assignments', {
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
});
