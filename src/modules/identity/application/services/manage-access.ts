import { withTransaction } from '@/db/client';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import { userPermissionGrants } from '@/db/schemas/identity/user-permission-grants';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import {
  isPermissionCode,
  type PermissionCode,
} from '@/lib/permissions/catalog';
import type { RequestContext } from '@/lib/tenancy/context';

import { requirePermission } from '../policies/require-permission';

/**
 * Assign a role to a membership at a scope (Admin surface). Requires
 * `admin:users`. The insert runs on the tenant connection (RLS-checked); the
 * cache-refresh trigger fires automatically. Full-audited + emits an event,
 * both transactional with the mutation.
 */
export async function assignRole(
  ctx: RequestContext,
  input: {
    membershipId: string;
    roleId: string;
    workshopId?: string | null;
    departmentId?: string | null;
  },
): Promise<void> {
  await requirePermission(ctx, 'admin:users');

  await withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(roleAssignments)
      .values({
        organizationId: ctx.organizationId,
        membershipId: input.membershipId,
        roleId: input.roleId,
        workshopId: input.workshopId ?? null,
        departmentId: input.departmentId ?? null,
        assignedByUserId: ctx.userId,
        createdBy: ctx.userId,
      })
      .returning({ id: roleAssignments.id });
    const assignmentId = inserted[0]?.id;

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'role_assignments',
      entityId: assignmentId ?? input.membershipId,
      after: {
        membershipId: input.membershipId,
        roleId: input.roleId,
        workshopId: input.workshopId ?? null,
        departmentId: input.departmentId ?? null,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'identity.role_assignment.granted',
      payload: {
        membershipId: input.membershipId,
        roleId: input.roleId,
        assignmentId,
      },
    });
  });
}

/**
 * Create a direct permission grant/deny override (Admin surface). Requires
 * `admin:users`. `reason` is mandatory (paper trail). Deny wins over grant in
 * resolution.
 */
export async function grantPermission(
  ctx: RequestContext,
  input: {
    membershipId: string;
    permissionCode: PermissionCode;
    kind: 'grant' | 'deny';
    reason: string;
    workshopId?: string | null;
    departmentId?: string | null;
  },
): Promise<void> {
  await requirePermission(ctx, 'admin:users');

  if (!isPermissionCode(input.permissionCode)) {
    throw new Error(`Unknown permission code: ${input.permissionCode}`);
  }
  if (!input.reason.trim()) {
    throw new Error('A reason is required for a direct permission grant/deny.');
  }

  await withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(userPermissionGrants)
      .values({
        organizationId: ctx.organizationId,
        membershipId: input.membershipId,
        permissionCode: input.permissionCode,
        kind: input.kind,
        reason: input.reason,
        workshopId: input.workshopId ?? null,
        departmentId: input.departmentId ?? null,
        grantedByUserId: ctx.userId,
        createdBy: ctx.userId,
      })
      .returning({ id: userPermissionGrants.id });
    const grantId = inserted[0]?.id;

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'user_permission_grants',
      entityId: grantId ?? input.membershipId,
      reason: input.reason,
      after: {
        membershipId: input.membershipId,
        permissionCode: input.permissionCode,
        kind: input.kind,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'identity.permission_grant.created',
      payload: {
        membershipId: input.membershipId,
        permissionCode: input.permissionCode,
        kind: input.kind,
        grantId,
      },
    });
  });
}
