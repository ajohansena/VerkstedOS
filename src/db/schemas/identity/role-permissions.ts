import { index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { roles } from '@/db/schemas/identity/roles';

/**
 * RolePermission — which permission codes a role grants. Permissions are code
 * (the catalog in src/lib/permissions/catalog.ts); this table stores the
 * assignment of codes to roles as data, so orgs can customize role bundles.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    /** A code from the permission catalog (validated in the service layer). */
    permissionCode: varchar('permission_code', { length: 64 }).notNull(),
    ...lifecycleColumns,
  },
  (table) => [
    unique('role_permissions_role_code_uq').on(
      table.roleId,
      table.permissionCode,
    ),
    index('role_permissions_org_idx').on(table.organizationId),
  ],
);
