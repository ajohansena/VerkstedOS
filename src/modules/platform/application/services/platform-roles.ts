import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { platformRoleAssignments } from '@/db/schemas/platform/platform-role-assignments';
import { platformUsers } from '@/db/schemas/platform/platform-users';
import type { PlatformContext } from '@/lib/platform/auth';
import type { PlatformRoleKey } from '@/lib/permissions/platform-catalog';

/**
 * Platform role management (Sprint 20 — Platform Maturity).
 *
 * The DB enforces the PlatformOwner singleton via a partial unique index
 * (`platform_role_assignments_one_active_owner_idx`, migration 0048). This
 * service adds a defence-in-depth check at the service layer so callers get a
 * typed error before the DB rejects the insert.
 *
 * Grants are recorded with `granted_by_user_id` so platform-audit can
 * reconstruct who granted what. Revocations stamp `revoked_at`; the previous
 * row remains for the audit trail.
 */

export class PlatformOwnerSingletonViolationError extends Error {
  constructor(public readonly currentOwnerPlatformUserId: string) {
    super(
      `Cannot grant PlatformOwner: an active owner already exists (platform_user_id=${currentOwnerPlatformUserId}). ` +
        `Revoke the existing owner in the same transaction (succession) to transfer the role.`,
    );
    this.name = 'PlatformOwnerSingletonViolationError';
  }
}

export class PlatformUserNotFoundError extends Error {
  constructor(public readonly platformUserId: string) {
    super(`Platform user ${platformUserId} not found or inactive.`);
    this.name = 'PlatformUserNotFoundError';
  }
}

export interface GrantPlatformRoleInput {
  readonly platformUserId: string;
  readonly role: PlatformRoleKey;
  readonly reason: string;
}

export async function grantPlatformRole(
  actor: PlatformContext,
  input: GrantPlatformRoleInput,
): Promise<{ assignmentId: string }> {
  // Only an active PlatformOwner can grant platform roles.
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can grant platform roles.');
  }

  const db = getRawClient({ as: 'platform-inspector' });

  // Confirm target platform user exists and is active.
  const targetRows = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(
      and(
        eq(platformUsers.id, input.platformUserId),
        eq(platformUsers.status, 'active'),
      ),
    )
    .limit(1);
  if (targetRows.length === 0) {
    throw new PlatformUserNotFoundError(input.platformUserId);
  }

  // Defence in depth: refuse PlatformOwner if any active row exists, BEFORE the DB rejects it.
  if (input.role === 'PlatformOwner') {
    const existing = await db
      .select({ platformUserId: platformRoleAssignments.platformUserId })
      .from(platformRoleAssignments)
      .where(
        and(
          eq(platformRoleAssignments.role, 'PlatformOwner'),
          isNull(platformRoleAssignments.revokedAt),
        ),
      )
      .limit(1);
    if (
      existing.length > 0 &&
      existing[0]!.platformUserId !== input.platformUserId
    ) {
      throw new PlatformOwnerSingletonViolationError(
        existing[0]!.platformUserId,
      );
    }
  }

  const inserted = await db
    .insert(platformRoleAssignments)
    .values({
      platformUserId: input.platformUserId,
      role: input.role,
      grantedByUserId: actor.userId,
      reason: input.reason,
    })
    .returning({ id: platformRoleAssignments.id });

  return { assignmentId: inserted[0]!.id };
}

export interface RevokePlatformRoleInput {
  readonly assignmentId: string;
  readonly reason: string;
}

export async function revokePlatformRole(
  actor: PlatformContext,
  input: RevokePlatformRoleInput,
): Promise<void> {
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can revoke platform roles.');
  }

  const db = getRawClient({ as: 'platform-inspector' });

  await db
    .update(platformRoleAssignments)
    .set({
      revokedAt: new Date(),
      reason: input.reason,
    })
    .where(
      and(
        eq(platformRoleAssignments.id, input.assignmentId),
        isNull(platformRoleAssignments.revokedAt),
      ),
    );
}
