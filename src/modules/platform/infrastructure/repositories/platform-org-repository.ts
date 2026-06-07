import { desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import type { Organization, Workshop } from '@/db/types';

/**
 * Platform inspection reads (Dev surface). Cross-org by nature, so these use the
 * admin escape hatch. In Sprint 4 the `/dev` surface gains hardened middleware
 * (platform auth + IP allow-list) and these reads move behind the
 * `is_platform_inspector` flag with platform-audit logging.
 */

export interface OrgListItem {
  readonly organization: Organization;
  readonly workshopCount: number;
}

export async function listAllOrganizations(): Promise<OrgListItem[]> {
  const db = getRawClient({ as: 'platform-inspector' });

  const orgs = await db
    .select()
    .from(organizations)
    .where(isNull(organizations.deletedAt))
    .orderBy(desc(organizations.createdAt));

  const workshopRows = await db
    .select({ organizationId: workshops.organizationId })
    .from(workshops)
    .where(isNull(workshops.deletedAt));

  const counts = new Map<string, number>();
  for (const row of workshopRows) {
    counts.set(row.organizationId, (counts.get(row.organizationId) ?? 0) + 1);
  }

  return orgs.map((organization) => ({
    organization,
    workshopCount: counts.get(organization.id) ?? 0,
  }));
}

export type OrgHealth = 'green' | 'yellow' | 'red';

export interface OrgInspection {
  readonly organization: Organization;
  readonly workshops: Workshop[];
  readonly memberCount: number;
  readonly health: OrgHealth;
}

/** Read-only org inspection with a health badge (Dev surface, /dev/orgs/[id]). */
export async function inspectOrganization(
  organizationId: string,
): Promise<OrgInspection | null> {
  const db = getRawClient({ as: 'platform-inspector' });

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const organization = orgRows[0];
  if (!organization) {
    return null;
  }

  const workshopRows = await db
    .select()
    .from(workshops)
    .where(eq(workshops.organizationId, organizationId));

  const memberRows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.organizationId, organizationId));

  // Health badge: red if suspended, yellow if no workshops or no members,
  // green otherwise. (Refined with operational signals in later sprints.)
  let health: OrgHealth = 'green';
  if (organization.status !== 'active') {
    health = 'red';
  } else if (workshopRows.length === 0 || memberRows.length === 0) {
    health = 'yellow';
  }

  return {
    organization,
    workshops: workshopRows,
    memberCount: memberRows.length,
    health,
  };
}
