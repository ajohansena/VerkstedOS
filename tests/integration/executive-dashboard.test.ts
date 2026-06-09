import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Executive dashboard integration suite (Sprint 20).
 *
 * Validates per-workshop snapshot computation introduced in Sprint 20:
 * `computeRolling30Snapshots` now writes 4 org-level + (4 × workshops) rows.
 * `listLatestSnapshotsByWorkshop` returns the per-workshop slice with the
 * `workshop_id` set. Chain totals on the executive dashboard are computed
 * from these rows.
 */
describe('executive dashboard (per-workshop KPI snapshots)', () => {
  let h: IsolationHarness;
  let dashboards: typeof import('@/modules/dashboards/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopAId: string;
  let workshopBId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    dashboards = await import('@/modules/dashboards/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000020c1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'exec20@example.no',
      fullName: 'Erika Executive',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Kjede Bilskade AS',
      ownerUserId,
    });
    orgId = organization.id;

    // Two workshops for the chain.
    const wsA = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Oslo Sentrum') RETURNING id
    `;
    workshopAId = wsA[0]!['id'] as string;
    const wsB = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Bergen Vest') RETURNING id
    `;
    workshopBId = wsB[0]!['id'] as string;

    // Seed: 4 delivered cases for Workshop A, 2 for Workshop B.
    const now = Date.now();
    const opened = new Date(now - 20 * 86400_000);
    const delivered = new Date(now - 8 * 86400_000);
    for (let i = 0; i < 4; i += 1) {
      await h.admin`
        INSERT INTO cases (organization_id, current_workshop_id, case_number, status, opened_at, delivered_at)
        VALUES (${orgId}, ${workshopAId}, ${'A-' + i}, 'delivered', ${opened}, ${delivered})
      `;
    }
    for (let i = 0; i < 2; i += 1) {
      await h.admin`
        INSERT INTO cases (organization_id, current_workshop_id, case_number, status, opened_at, delivered_at)
        VALUES (${orgId}, ${workshopBId}, ${'B-' + i}, 'delivered', ${opened}, ${delivered})
      `;
    }
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId: null,
      accessibleWorkshopIds: [] as string[],
      correlationId: '00000000-0000-0000-0000-0000000020fe',
    };
  }

  it('writes per-workshop snapshots in addition to org-level snapshots', async () => {
    const result = await dashboards.computeRolling30Snapshots(ctx());
    // 4 org-level + (4 × 2 workshops) = 12 writes.
    expect(result.computed).toBe(4 + 4 * 2);
  });

  it('lists snapshots per workshop with workshop_id set', async () => {
    const rows = await dashboards.listLatestSnapshotsByWorkshop(
      ctx(),
      'rolling_30',
    );
    // 4 KPIs × 2 workshops.
    expect(rows.length).toBe(8);
    expect(rows.every((r) => r.workshopId !== null)).toBe(true);

    // Workshop A: 4 delivered, Workshop B: 2 delivered.
    const a = rows.find(
      (r) => r.workshopId === workshopAId && r.kpiCode === 'throughput',
    );
    const b = rows.find(
      (r) => r.workshopId === workshopBId && r.kpiCode === 'throughput',
    );
    expect(Number(a!.value)).toBe(4);
    expect(Number(b!.value)).toBe(2);
  });

  it('chain totals match the sum of per-workshop snapshots', async () => {
    const rows = await dashboards.listLatestSnapshotsByWorkshop(
      ctx(),
      'rolling_30',
    );
    const chainThroughput = rows
      .filter((r) => r.kpiCode === 'throughput')
      .reduce((sum, r) => sum + Number(r.value), 0);
    expect(chainThroughput).toBe(6); // 4 + 2
  });
});
