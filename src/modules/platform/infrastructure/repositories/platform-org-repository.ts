import { desc, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import type { Organization } from '@/db/types';

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
