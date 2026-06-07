import { pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

import { platformRole } from '@/db/enums';

/**
 * Platform role → permission mapping (docs/06-developer-control-plane.md).
 *
 * Platform permissions are CODE (src/lib/permissions/platform-catalog.ts); this
 * table stores which platform role holds which code, seeded from the standard
 * bundles. Composite PK (role, permission_code).
 */
export const platformRolePermissions = pgTable(
  'platform_role_permissions',
  {
    role: platformRole('role').notNull(),
    permissionCode: varchar('permission_code', { length: 64 }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'platform_role_permissions_pk',
      columns: [table.role, table.permissionCode],
    }),
  ],
);
