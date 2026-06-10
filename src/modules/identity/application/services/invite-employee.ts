import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import { roles } from '@/db/schemas/identity/roles';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { inviteAuthUser } from '@/lib/supabase/admin';
import type { RequestContext } from '@/lib/tenancy/context';

import { requirePermission } from '../policies/require-permission';
import { ensureUser } from '../../infrastructure/repositories/user-repository';

/**
 * Customer-Owner invite flow (Sprint 20 — Platform Maturity).
 *
 * Composes Supabase Auth admin invite + ensureUser + tenant-context membership
 * insert + role assignment. PlatformOwner is NEVER involved: any Owner with
 * `admin:users` can run this.
 *
 * Mutations are wrapped in a tenant transaction so audit + outbox land
 * together with the inserts. RLS verifies the actor belongs to the same org.
 */

export interface InviteEmployeeInput {
  readonly email: string;
  readonly fullName: string;
  readonly roleId: string;
  readonly workshopId?: string | null;
  readonly departmentId?: string | null;
}

export interface InviteEmployeeResult {
  readonly membershipId: string;
  readonly userId: string;
  readonly inviteEmailSent: boolean;
  readonly alreadyMember: boolean;
}

export async function inviteEmployee(
  ctx: RequestContext,
  input: InviteEmployeeInput,
): Promise<InviteEmployeeResult> {
  await requirePermission(ctx, 'admin:users');

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName) {
    throw new Error('Email and full name are required.');
  }

  // 1. Verify the chosen role belongs to this org (defence in depth).
  const adminDb = getRawClient({ as: 'admin' });
  const roleRows = await adminDb
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.id, input.roleId),
        eq(roles.organizationId, ctx.organizationId),
        isNull(roles.deletedAt),
      ),
    )
    .limit(1);
  if (roleRows.length === 0) {
    throw new Error('Role does not belong to this organization.');
  }

  // 2. Provision Supabase Auth user (idempotent on email).
  const invite = await inviteAuthUser({ email, fullName });

  // 3. Mirror into app users table.
  await ensureUser({ id: invite.userId, email, fullName });

  // 4. Membership + role assignment in tenant transaction (audited + emitted).
  const result = await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, ctx.organizationId),
          eq(memberships.userId, invite.userId),
          isNull(memberships.deletedAt),
        ),
      )
      .limit(1);

    let membershipId = existing[0]?.id;
    let alreadyMember = membershipId !== undefined;

    if (!membershipId) {
      const inserted = await tx
        .insert(memberships)
        .values({
          organizationId: ctx.organizationId,
          userId: invite.userId,
          status: 'invited',
          defaultWorkshopId: input.workshopId ?? null,
          createdBy: ctx.userId,
        })
        .returning({ id: memberships.id });
      membershipId = inserted[0]?.id;
      if (!membershipId) throw new Error('Failed to create membership.');

      await recordAuditEvent(tx, ctx, {
        action: 'created',
        entityTable: 'memberships',
        entityId: membershipId,
        after: { userId: invite.userId, status: 'invited' },
      });
    }

    const insertedAssignment = await tx
      .insert(roleAssignments)
      .values({
        organizationId: ctx.organizationId,
        membershipId,
        roleId: input.roleId,
        workshopId: input.workshopId ?? null,
        departmentId: input.departmentId ?? null,
        assignedByUserId: ctx.userId,
        createdBy: ctx.userId,
      })
      .returning({ id: roleAssignments.id });

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'role_assignments',
      entityId: insertedAssignment[0]?.id ?? membershipId,
      after: {
        membershipId,
        roleId: input.roleId,
        workshopId: input.workshopId ?? null,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'identity.employee.invited',
      payload: {
        membershipId,
        userId: invite.userId,
        email,
        roleId: input.roleId,
        inviteEmailSent: invite.emailSent,
      },
    });

    return { membershipId, alreadyMember };
  });

  return {
    membershipId: result.membershipId,
    userId: invite.userId,
    inviteEmailSent: invite.emailSent,
    alreadyMember: result.alreadyMember,
  };
}

export async function setMembershipStatus(
  ctx: RequestContext,
  input: { membershipId: string; status: 'active' | 'suspended' },
): Promise<void> {
  await requirePermission(ctx, 'admin:users');

  await withTransaction(ctx, async (tx) => {
    // Load before-state for audit.
    const before = await tx
      .select({ id: memberships.id, status: memberships.status })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, input.membershipId),
          eq(memberships.organizationId, ctx.organizationId),
          isNull(memberships.deletedAt),
        ),
      )
      .limit(1);
    const prev = before[0];
    if (!prev) throw new Error('Membership not found.');

    await tx
      .update(memberships)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(memberships.id, input.membershipId));

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'memberships',
      entityId: input.membershipId,
      before: { status: prev.status },
      after: { status: input.status },
    });

    await emitEvent(tx, ctx, {
      eventType: 'identity.membership.status_changed',
      payload: {
        membershipId: input.membershipId,
        from: prev.status,
        to: input.status,
      },
    });
  });
}
