import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import type { Organization, Workshop } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Identity read repository.
 *
 * Two kinds of reads live here:
 *   - Bootstrap reads (membership/org resolution) run BEFORE org context
 *     exists, so they use the admin escape hatch but are always filtered by the
 *     authenticated user's own id.
 *   - Org-scoped reads run inside the tenant transaction and additionally
 *     filter by `organization_id` (primary defense; RLS is the backstop).
 */

export interface UserOrganization {
  readonly organization: Organization;
  readonly defaultWorkshopId: string | null;
}

/** All active organizations the user belongs to (for the org switcher). */
export async function listOrganizationsForUser(
  userId: string,
): Promise<UserOrganization[]> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db
    .select({
      organization: organizations,
      defaultWorkshopId: memberships.defaultWorkshopId,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, 'active'),
        isNull(memberships.deletedAt),
        isNull(organizations.deletedAt),
      ),
    );

  return rows.map((row) => ({
    organization: row.organization,
    defaultWorkshopId: row.defaultWorkshopId,
  }));
}

/** Whether the user has an active membership in the given org. */
export async function userBelongsToOrg(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
        isNull(memberships.deletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Active workshops in the current org (tenant-scoped read). */
export async function listWorkshops(ctx: RequestContext): Promise<Workshop[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(workshops)
      .where(
        and(
          eq(workshops.organizationId, ctx.organizationId),
          isNull(workshops.deletedAt),
        ),
      )
      .orderBy(workshops.name);
  });
}

/** The active org record (tenant-scoped read). */
export async function getCurrentOrganization(
  ctx: RequestContext,
): Promise<Organization | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);
    return rows[0] ?? null;
  });
}
