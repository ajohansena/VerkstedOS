import { and, eq, isNull, or, sql, type SQL, type Column } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import { rolePermissions } from '@/db/schemas/identity/role-permissions';
import { userPermissionGrants } from '@/db/schemas/identity/user-permission-grants';
import type { PermissionCode } from '@/lib/permissions/catalog';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Permission resolver — the AUTHORITATIVE, scope-aware permission check
 * (docs/05-multi-tenant-and-rbac.md). The effective_permissions_cache backs the
 * coarse RLS function; this resolver is the rich service-layer truth that also
 * honours workshop/department scope and live time windows.
 *
 * Resolution (deny wins):
 *   1. Collect permissions from active role assignments whose scope covers the
 *      requested target.
 *   2. Add active direct grants whose scope covers the target.
 *   3. Remove active direct denies whose scope covers the target.
 */

export interface PermissionScope {
  readonly workshopId?: string | null;
  readonly departmentId?: string | null;
}

/**
 * A scope row "covers" a requested target when it is unscoped (org-wide), or it
 * matches the requested workshop (and, if it has a department, the requested
 * department). Null columns widen coverage.
 */
function scopeCovers(
  row: { workshopId: string | null; departmentId: string | null },
  target: PermissionScope,
): boolean {
  if (row.workshopId === null) {
    return true; // org-wide
  }
  if (row.workshopId !== (target.workshopId ?? null)) {
    return false;
  }
  if (row.departmentId === null) {
    return true; // workshop-wide
  }
  return row.departmentId === (target.departmentId ?? null);
}

const activeWindow = (from: Column, until: Column): SQL =>
  and(
    or(isNull(from), sql`${from} <= now()`),
    or(isNull(until), sql`${until} > now()`),
  ) as SQL;

/** Resolve whether the user in `ctx` holds `permission` at the given scope. */
export async function hasPermission(
  ctx: RequestContext,
  permission: PermissionCode,
  scope: PermissionScope = {},
  existingTx?: TenantTransaction,
): Promise<boolean> {
  const run = async (tx: TenantTransaction): Promise<boolean> => {
    const membershipRows = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, ctx.userId),
          eq(memberships.organizationId, ctx.organizationId),
          eq(memberships.status, 'active'),
          isNull(memberships.deletedAt),
        ),
      )
      .limit(1);
    const membership = membershipRows[0];
    if (!membership) {
      return false;
    }

    // Active denies covering the target → permission denied outright.
    const denies = await tx
      .select({
        workshopId: userPermissionGrants.workshopId,
        departmentId: userPermissionGrants.departmentId,
      })
      .from(userPermissionGrants)
      .where(
        and(
          eq(userPermissionGrants.membershipId, membership.id),
          eq(userPermissionGrants.permissionCode, permission),
          eq(userPermissionGrants.kind, 'deny'),
          isNull(userPermissionGrants.deletedAt),
          activeWindow(
            userPermissionGrants.validFrom,
            userPermissionGrants.validUntil,
          ),
        ),
      );
    if (denies.some((row) => scopeCovers(row, scope))) {
      return false;
    }

    // Active grants covering the target.
    const grants = await tx
      .select({
        workshopId: userPermissionGrants.workshopId,
        departmentId: userPermissionGrants.departmentId,
      })
      .from(userPermissionGrants)
      .where(
        and(
          eq(userPermissionGrants.membershipId, membership.id),
          eq(userPermissionGrants.permissionCode, permission),
          eq(userPermissionGrants.kind, 'grant'),
          isNull(userPermissionGrants.deletedAt),
          activeWindow(
            userPermissionGrants.validFrom,
            userPermissionGrants.validUntil,
          ),
        ),
      );
    if (grants.some((row) => scopeCovers(row, scope))) {
      return true;
    }

    // Permissions via active role assignments covering the target.
    const roleRows = await tx
      .select({
        workshopId: roleAssignments.workshopId,
        departmentId: roleAssignments.departmentId,
      })
      .from(roleAssignments)
      .innerJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, roleAssignments.roleId),
          eq(rolePermissions.permissionCode, permission),
          isNull(rolePermissions.deletedAt),
        ),
      )
      .where(
        and(
          eq(roleAssignments.membershipId, membership.id),
          isNull(roleAssignments.deletedAt),
          activeWindow(roleAssignments.validFrom, roleAssignments.validUntil),
        ),
      );
    return roleRows.some((row) => scopeCovers(row, scope));
  };

  return existingTx ? run(existingTx) : withTransaction(ctx, run);
}
