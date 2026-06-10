import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import type { Organization, Workshop } from '@/db/types';
import type { PlatformContext } from '@/lib/platform/auth';
import { inviteAuthUser } from '@/lib/supabase/admin';
import {
  createOrganizationWithOwner,
  ensureUser,
} from '@/modules/identity/public';

/**
 * Platform-level organization management (Sprint 20 — Platform Maturity).
 *
 * These services compose existing identity primitives but run with platform
 * authority — they are invoked by the PlatformOwner from `/dev/orgs/new` and
 * `/dev/orgs/[id]` and do NOT require a customer-org context (the org may not
 * yet exist, or the platform user may not be a member of it).
 *
 * Owner provisioning uses the Supabase Auth admin client to invite the first
 * Owner by email; that email arrives with a magic-link the new user follows to
 * set their password. No customer-side self-registration path is used.
 *
 * IMPORTANT: this service NEVER grants `PlatformOwner`. The owner role created
 * here is the customer-org `owner` role only.
 */

export interface ProvisionOrganizationInput {
  readonly orgName: string;
  readonly orgNumber?: string | null;
  readonly workshopName: string;
  readonly ownerEmail: string;
  readonly ownerFullName: string;
}

export interface ProvisionOrganizationResult {
  readonly organization: Organization;
  readonly workshop: Workshop;
  readonly ownerUserId: string;
  readonly ownerEmail: string;
  readonly inviteEmailSent: boolean;
}

export async function provisionOrganization(
  actor: PlatformContext,
  input: ProvisionOrganizationInput,
): Promise<ProvisionOrganizationResult> {
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can provision organizations.');
  }

  const orgName = input.orgName.trim();
  const workshopName = input.workshopName.trim();
  const ownerFullName = input.ownerFullName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!orgName) throw new Error('Organization name is required.');
  if (!workshopName) throw new Error('Workshop name is required.');
  if (!ownerEmail) throw new Error('Owner email is required.');
  if (!ownerFullName) throw new Error('Owner full name is required.');

  // 1. Provision Supabase Auth user (idempotent on email).
  const invite = await inviteAuthUser({
    email: ownerEmail,
    fullName: ownerFullName,
  });

  // 2. Mirror into app users table.
  await ensureUser({
    id: invite.userId,
    email: invite.email,
    fullName: ownerFullName,
  });

  // 3. Create org + seed standard roles + assign customer-org Owner.
  const { organization } = await createOrganizationWithOwner({
    name: orgName,
    ownerUserId: invite.userId,
    ...(input.orgNumber ? { orgNumber: input.orgNumber } : {}),
  });

  // 4. First workshop (admin client — no tenant context exists for actor).
  const db = getRawClient({ as: 'admin' });
  const insertedWorkshop = await db
    .insert(workshops)
    .values({
      organizationId: organization.id,
      name: workshopName,
      createdBy: invite.userId,
      updatedBy: invite.userId,
    })
    .returning();
  const workshop = insertedWorkshop[0];
  if (!workshop) throw new Error('Failed to create initial workshop.');

  return {
    organization,
    workshop,
    ownerUserId: invite.userId,
    ownerEmail: invite.email,
    inviteEmailSent: invite.emailSent,
  };
}

async function updateOrgStatus(
  actor: PlatformContext,
  organizationId: string,
  status: 'active' | 'suspended',
): Promise<void> {
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can change organization status.');
  }
  const db = getRawClient({ as: 'admin' });
  await db
    .update(organizations)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)),
    );
}

export async function deactivateOrganization(
  actor: PlatformContext,
  organizationId: string,
): Promise<void> {
  await updateOrgStatus(actor, organizationId, 'suspended');
}

export async function reactivateOrganization(
  actor: PlatformContext,
  organizationId: string,
): Promise<void> {
  await updateOrgStatus(actor, organizationId, 'active');
}

export async function archiveOrganization(
  actor: PlatformContext,
  organizationId: string,
): Promise<void> {
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can archive organizations.');
  }
  const db = getRawClient({ as: 'admin' });
  await db
    .update(organizations)
    .set({ deletedAt: new Date(), updatedAt: new Date(), status: 'suspended' })
    .where(
      and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)),
    );
}

export async function unarchiveOrganization(
  actor: PlatformContext,
  organizationId: string,
): Promise<void> {
  if (!actor.roles.includes('PlatformOwner')) {
    throw new Error('Only PlatformOwner can unarchive organizations.');
  }
  const db = getRawClient({ as: 'admin' });
  await db
    .update(organizations)
    .set({ deletedAt: null, updatedAt: new Date(), status: 'active' })
    .where(eq(organizations.id, organizationId));
}
