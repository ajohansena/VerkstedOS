import { and, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { roles } from '@/db/schemas/identity/roles';
import { rolePermissions } from '@/db/schemas/identity/role-permissions';
import { STANDARD_ROLES } from '@/lib/permissions/standard-roles';

/**
 * Seed the six standard roles + their permission bundles for an organization
 * (docs/05-multi-tenant-and-rbac.md, ADR-018). Idempotent on `(org, role.key)`.
 *
 * Runs via the service-role connection (bootstrap, before/around org context).
 * Returns a map of role key → role id.
 */
export async function seedStandardRoles(
  organizationId: string,
): Promise<Map<string, string>> {
  const db = getRawClient({ as: 'admin' });
  const result = new Map<string, string>();

  for (const def of STANDARD_ROLES) {
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(eq(roles.organizationId, organizationId), eq(roles.key, def.key)),
      )
      .limit(1);

    let roleId = existing[0]?.id;
    if (!roleId) {
      const inserted = await db
        .insert(roles)
        .values({
          organizationId,
          name: def.name,
          description: def.description,
          key: def.key,
          isSystem: true,
        })
        .returning({ id: roles.id });
      roleId = inserted[0]?.id;
    }
    if (!roleId) {
      throw new Error(
        `Failed to seed role ${def.key} for org ${organizationId}`,
      );
    }
    result.set(def.key, roleId);

    // Upsert the permission bundle (insert missing codes; ignore existing).
    for (const code of def.permissions) {
      await db
        .insert(rolePermissions)
        .values({ organizationId, roleId, permissionCode: code })
        .onConflictDoNothing({
          target: [rolePermissions.roleId, rolePermissions.permissionCode],
        });
    }
  }

  return result;
}
