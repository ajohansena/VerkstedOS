import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { roleAssignments } from '@/db/schemas/identity/role-assignments';
import type { Organization } from '@/db/types';

import { seedStandardRoles } from './seed-standard-roles';

/**
 * Bootstrap a new organization with an owner (docs/05 onboarding). Creates the
 * org, seeds the six standard roles, creates the owner's membership, and assigns
 * the Owner role org-wide. Runs on the service-role connection because it
 * executes before any org context exists.
 *
 * Idempotent-ish: re-running for an existing (org name + user) creates a new org
 * unless `organizationId` is supplied to attach to an existing one.
 */
export async function createOrganizationWithOwner(input: {
  name: string;
  ownerUserId: string;
  orgNumber?: string;
}): Promise<{ organization: Organization; membershipId: string }> {
  const db = getRawClient({ as: 'admin' });

  const insertedOrg = await db
    .insert(organizations)
    .values({
      name: input.name,
      orgNumber: input.orgNumber ?? null,
      createdBy: input.ownerUserId,
    })
    .returning();
  const organization = insertedOrg[0];
  if (!organization) {
    throw new Error('Failed to create organization');
  }

  const roleMap = await seedStandardRoles(organization.id);
  const ownerRoleId = roleMap.get('owner');
  if (!ownerRoleId) {
    throw new Error('Owner role missing after seeding');
  }

  const insertedMembership = await db
    .insert(memberships)
    .values({
      organizationId: organization.id,
      userId: input.ownerUserId,
      status: 'active',
      createdBy: input.ownerUserId,
    })
    .returning({ id: memberships.id });
  const membershipId = insertedMembership[0]?.id;
  if (!membershipId) {
    throw new Error('Failed to create owner membership');
  }

  await db.insert(roleAssignments).values({
    organizationId: organization.id,
    membershipId,
    roleId: ownerRoleId,
    assignedByUserId: input.ownerUserId,
  });

  return { organization, membershipId };
}

/** Add an existing user to an org with a role (the data side of "invite"). */
export async function addMembershipWithRole(input: {
  organizationId: string;
  userId: string;
  roleId: string;
  assignedByUserId: string;
  defaultWorkshopId?: string | null;
}): Promise<{ membershipId: string }> {
  const db = getRawClient({ as: 'admin' });

  // Reuse an existing membership if present, else create one.
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(memberships.userId, input.userId),
        isNull(memberships.deletedAt),
      ),
    )
    .limit(1);

  let membershipId = existing[0]?.id;
  if (!membershipId) {
    const inserted = await db
      .insert(memberships)
      .values({
        organizationId: input.organizationId,
        userId: input.userId,
        status: 'active',
        defaultWorkshopId: input.defaultWorkshopId ?? null,
        createdBy: input.assignedByUserId,
      })
      .returning({ id: memberships.id });
    membershipId = inserted[0]?.id;
  }
  if (!membershipId) {
    throw new Error('Failed to create membership');
  }

  await db.insert(roleAssignments).values({
    organizationId: input.organizationId,
    membershipId,
    roleId: input.roleId,
    assignedByUserId: input.assignedByUserId,
  });

  return { membershipId };
}
