import { index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';

/**
 * EffectivePermissionsCache — denormalized projection of the ORG-LEVEL
 * permissions a user effectively holds (docs/05-multi-tenant-and-rbac.md).
 *
 * Used by the coarse RLS check `app_has_permission(code)` and as the fast path
 * for the TS resolver. Refreshed by triggers when role assignments,
 * role permissions, or grants change. This is a read-model (audit tier: none) —
 * the authoritative source is the role/grant tables.
 *
 * Scope-aware (workshop/department) precision is enforced in the service layer;
 * this cache is intentionally org-coarse for fast fail-closed RLS.
 */
export const effectivePermissionsCache = pgTable(
  'effective_permissions_cache',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionCode: varchar('permission_code', { length: 64 }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'effective_permissions_cache_pk',
      columns: [table.organizationId, table.userId, table.permissionCode],
    }),
    index('effective_permissions_cache_user_idx').on(
      table.organizationId,
      table.userId,
    ),
  ],
);
