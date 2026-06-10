import { and, eq, isNull, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { effectivePermissionsCache } from '@/db/schemas/identity/effective-permissions-cache';
import { memberships } from '@/db/schemas/identity/memberships';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import { rolePermissions } from '@/db/schemas/identity/role-permissions';
import { roles } from '@/db/schemas/identity/roles';
import { users } from '@/db/schemas/identity/users';
import type { RequestContext } from '@/lib/tenancy/context';

export interface RoleListItem {
  readonly id: string;
  readonly name: string;
  readonly key: string | null;
  readonly isSystem: boolean;
  readonly permissionCount: number;
}

/** Roles in the current org with permission counts (Admin surface). */
export async function listRoles(ctx: RequestContext): Promise<RoleListItem[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: roles.id,
        name: roles.name,
        key: roles.key,
        isSystem: roles.isSystem,
        permissionCount: sql<number>`count(${rolePermissions.id})::int`,
      })
      .from(roles)
      .leftJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, roles.id),
          isNull(rolePermissions.deletedAt),
        ),
      )
      .where(
        and(
          eq(roles.organizationId, ctx.organizationId),
          isNull(roles.deletedAt),
        ),
      )
      .groupBy(roles.id)
      .orderBy(roles.name);
    return rows;
  });
}

export interface OrgMember {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly status: 'active' | 'invited' | 'suspended';
  readonly roleNames: string[];
}

/** Members of the current org with their assigned role names (Admin surface). */
export async function listOrgMembers(
  ctx: RequestContext,
): Promise<OrgMember[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        membershipId: memberships.id,
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        status: memberships.status,
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(
        roleAssignments,
        and(
          eq(roleAssignments.membershipId, memberships.id),
          isNull(roleAssignments.deletedAt),
        ),
      )
      .leftJoin(roles, eq(roles.id, roleAssignments.roleId))
      .where(
        and(
          eq(memberships.organizationId, ctx.organizationId),
          isNull(memberships.deletedAt),
        ),
      )
      .orderBy(users.email);

    const byMembership = new Map<string, OrgMember>();
    for (const row of rows) {
      const existing = byMembership.get(row.membershipId);
      if (existing) {
        if (row.roleName) existing.roleNames.push(row.roleName);
      } else {
        byMembership.set(row.membershipId, {
          membershipId: row.membershipId,
          userId: row.userId,
          email: row.email,
          fullName: row.fullName,
          status: row.status as 'active' | 'invited' | 'suspended',
          roleNames: row.roleName ? [row.roleName] : [],
        });
      }
    }
    return [...byMembership.values()];
  });
}

/** Effective (org-coarse) permission codes for a user, from the cache. */
export async function getEffectivePermissionCodes(
  ctx: RequestContext,
  userId: string,
): Promise<string[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ code: effectivePermissionsCache.permissionCode })
      .from(effectivePermissionsCache)
      .where(
        and(
          eq(effectivePermissionsCache.organizationId, ctx.organizationId),
          eq(effectivePermissionsCache.userId, userId),
        ),
      )
      .orderBy(effectivePermissionsCache.permissionCode);
    return rows.map((r) => r.code);
  });
}
