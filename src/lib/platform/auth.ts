import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { platformRoleAssignments } from '@/db/schemas/platform/platform-role-assignments';
import { platformUsers } from '@/db/schemas/platform/platform-users';
import {
  PLATFORM_ROLE_PERMISSIONS,
  type PlatformPermissionCode,
  type PlatformRoleKey,
} from '@/lib/permissions/platform-catalog';

/**
 * Platform context — the Dev Control Plane authorization track
 * (docs/06-developer-control-plane.md). Completely separate from customer RBAC.
 *
 * Resolution uses the service-role connection because platform tables are
 * invisible to tenant connections (locked by RLS). A user with no active
 * `platform_users` row has NO platform context → the `/dev` surface returns 404.
 */
export interface PlatformContext {
  readonly platformUserId: string;
  readonly userId: string;
  readonly roles: readonly PlatformRoleKey[];
  readonly permissions: ReadonlySet<PlatformPermissionCode>;
}

export async function resolvePlatformContext(
  userId: string,
): Promise<PlatformContext | null> {
  const db = getRawClient({ as: 'platform-inspector' });

  const puRows = await db
    .select()
    .from(platformUsers)
    .where(
      and(eq(platformUsers.userId, userId), eq(platformUsers.status, 'active')),
    )
    .limit(1);
  const platformUser = puRows[0];
  if (!platformUser) {
    return null;
  }

  const assignmentRows = await db
    .select({ role: platformRoleAssignments.role })
    .from(platformRoleAssignments)
    .where(
      and(
        eq(platformRoleAssignments.platformUserId, platformUser.id),
        isNull(platformRoleAssignments.revokedAt),
      ),
    );

  const roles = assignmentRows.map((r) => r.role as PlatformRoleKey);
  const permissions = new Set<PlatformPermissionCode>();
  for (const role of roles) {
    for (const code of PLATFORM_ROLE_PERMISSIONS[role]) {
      permissions.add(code);
    }
  }

  return {
    platformUserId: platformUser.id,
    userId,
    roles,
    permissions,
  };
}

export function platformCan(
  ctx: PlatformContext,
  code: PlatformPermissionCode,
): boolean {
  return ctx.permissions.has(code);
}
