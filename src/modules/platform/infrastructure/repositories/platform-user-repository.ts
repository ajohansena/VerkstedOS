import { and, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { effectivePermissionsCache } from '@/db/schemas/identity/effective-permissions-cache';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import { roles } from '@/db/schemas/identity/roles';
import { users } from '@/db/schemas/identity/users';

/**
 * Platform user inspection (Dev surface). Cross-org by nature → service-role
 * connection. In Sprint 4 this moves behind hardened `/dev` middleware +
 * platform-audit logging.
 */

export interface UserMembershipInspection {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly membershipId: string;
  readonly status: string;
  readonly roleNames: string[];
  readonly effectivePermissions: string[];
}

export interface UserInspection {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly status: string;
  readonly memberships: UserMembershipInspection[];
}

export async function inspectUser(
  userId: string,
): Promise<UserInspection | null> {
  const db = getRawClient({ as: 'platform-inspector' });

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return null;
  }

  const membershipRows = await db
    .select({
      membershipId: memberships.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId));

  const result: UserMembershipInspection[] = [];
  for (const m of membershipRows) {
    const roleRows = await db
      .select({ name: roles.name })
      .from(roleAssignments)
      .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
      .where(eq(roleAssignments.membershipId, m.membershipId));

    const permRows = await db
      .select({ code: effectivePermissionsCache.permissionCode })
      .from(effectivePermissionsCache)
      .where(
        and(
          eq(effectivePermissionsCache.organizationId, m.organizationId),
          eq(effectivePermissionsCache.userId, userId),
        ),
      )
      .orderBy(effectivePermissionsCache.permissionCode);

    result.push({
      organizationId: m.organizationId,
      organizationName: m.organizationName,
      membershipId: m.membershipId,
      status: m.status,
      roleNames: roleRows.map((r) => r.name),
      effectivePermissions: permRows.map((r) => r.code),
    });
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    memberships: result,
  };
}
