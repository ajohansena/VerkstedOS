import { desc, eq, max } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { kpiDefinitions } from '@/db/schemas/dashboards/kpi-definitions';
import { kpiSnapshots } from '@/db/schemas/dashboards/kpi-snapshots';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Platform-level dashboard inspection (Sprint 20 — Platform Maturity).
 *
 * Cross-org reads of the KPI snapshot freshness so the platform operator can
 * spot orgs where the nightly KPI job has stalled. Detail per org reuses the
 * existing per-tenant repositories — this surface is for triage only.
 */

export interface DashboardOrgRow {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly kpiDefinitionCount: number;
  readonly latestSnapshotAt: Date | null;
  readonly snapshotCount: number;
}

export async function listDashboardHealth(): Promise<DashboardOrgRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  // Per-org KPI definition count.
  const defRows = await db
    .select({ organizationId: kpiDefinitions.organizationId })
    .from(kpiDefinitions);
  const defCount = new Map<string, number>();
  for (const r of defRows) {
    defCount.set(r.organizationId, (defCount.get(r.organizationId) ?? 0) + 1);
  }

  // Per-org latest snapshot timestamp + snapshot count.
  const snapRows = await db
    .select({
      organizationId: kpiSnapshots.organizationId,
      latest: max(kpiSnapshots.computedAt),
    })
    .from(kpiSnapshots)
    .groupBy(kpiSnapshots.organizationId);
  const latestByOrg = new Map<string, Date>();
  for (const r of snapRows) {
    if (r.latest) latestByOrg.set(r.organizationId, r.latest);
  }

  const allSnaps = await db
    .select({ organizationId: kpiSnapshots.organizationId })
    .from(kpiSnapshots);
  const snapCount = new Map<string, number>();
  for (const r of allSnaps) {
    snapCount.set(r.organizationId, (snapCount.get(r.organizationId) ?? 0) + 1);
  }

  return orgs.map((o) => ({
    organizationId: o.id,
    organizationName: o.name,
    kpiDefinitionCount: defCount.get(o.id) ?? 0,
    latestSnapshotAt: latestByOrg.get(o.id) ?? null,
    snapshotCount: snapCount.get(o.id) ?? 0,
  }));
}

export interface DashboardOrgDetail {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly definitions: { code: string; category: string; unit: string }[];
  readonly latestSnapshots: {
    kpiCode: string;
    value: string;
    period: string;
    periodStart: Date;
    computedAt: Date;
  }[];
}

export async function inspectDashboardOrg(
  organizationId: string,
): Promise<DashboardOrgDetail | null> {
  const db = getRawClient({ as: 'platform-inspector' });

  const orgRows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const org = orgRows[0];
  if (!org) return null;

  const defs = await db
    .select({
      code: kpiDefinitions.code,
      category: kpiDefinitions.category,
      unit: kpiDefinitions.unit,
    })
    .from(kpiDefinitions)
    .where(eq(kpiDefinitions.organizationId, organizationId))
    .orderBy(kpiDefinitions.category, kpiDefinitions.code);

  const snaps = await db
    .select({
      kpiCode: kpiSnapshots.kpiCode,
      value: kpiSnapshots.value,
      period: kpiSnapshots.period,
      periodStart: kpiSnapshots.periodStart,
      computedAt: kpiSnapshots.computedAt,
    })
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.organizationId, organizationId))
    .orderBy(desc(kpiSnapshots.computedAt))
    .limit(50);

  return {
    organizationId,
    organizationName: org.name,
    definitions: defs,
    latestSnapshots: snaps.map((s) => ({
      kpiCode: s.kpiCode,
      value: String(s.value ?? '0'),
      period: s.period,
      periodStart: s.periodStart,
      computedAt: s.computedAt,
    })),
  };
}
