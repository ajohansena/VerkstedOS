import { desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Platform-level workshop inspection (Sprint 20 — Platform Maturity).
 * Cross-org by nature → uses the platform-inspector admin escape hatch.
 */

export interface PlatformWorkshopRow {
  readonly workshopId: string;
  readonly workshopName: string;
  readonly workshopStatus: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly memberCount: number;
}

export async function listAllWorkshops(): Promise<PlatformWorkshopRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });

  const rows = await db
    .select({
      workshopId: workshops.id,
      workshopName: workshops.name,
      workshopStatus: workshops.status,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(workshops)
    .innerJoin(organizations, eq(organizations.id, workshops.organizationId))
    .where(isNull(workshops.deletedAt))
    .orderBy(desc(workshops.createdAt));

  // Member counts (membership.defaultWorkshopId).
  const memberRows = await db
    .select({
      workshopId: memberships.defaultWorkshopId,
    })
    .from(memberships)
    .where(isNull(memberships.deletedAt));

  const memberCounts = new Map<string, number>();
  for (const r of memberRows) {
    if (!r.workshopId) continue;
    memberCounts.set(r.workshopId, (memberCounts.get(r.workshopId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    workshopId: r.workshopId,
    workshopName: r.workshopName,
    workshopStatus: r.workshopStatus,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    memberCount: memberCounts.get(r.workshopId) ?? 0,
  }));
}
