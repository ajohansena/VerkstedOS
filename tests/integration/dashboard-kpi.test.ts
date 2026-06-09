import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Dashboard KPI snapshot integration suite (Sprint 16).
 *
 * Validates the nightly snapshot computation against real Postgres + RLS: with
 * delivered cases present, `computeRolling30Snapshots` writes the four
 * canonical KPI snapshots (throughput, cycle_time, on_time_rate, utilization),
 * re-running UPSERTs (no duplicates), and `listLatestSnapshots` returns them.
 */
describe('dashboard KPI snapshots', () => {
  let h: IsolationHarness;
  let dashboards: typeof import('@/modules/dashboards/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    dashboards = await import('@/modules/dashboards/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000e1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner16@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Dashboard Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    // Seed delivered cases: opened 20 days ago, delivered 8 days ago (12-day
    // cycle → within the 12-day normal promise → on-time).
    const now = Date.now();
    const opened = new Date(now - 20 * 86400_000);
    const delivered = new Date(now - 8 * 86400_000);
    for (let i = 0; i < 3; i += 1) {
      await h.admin`
        INSERT INTO cases (organization_id, case_number, status, opened_at, delivered_at)
        VALUES (${orgId}, ${'D-' + i}, 'delivered', ${opened}, ${delivered})
      `;
    }
    // One still-open case opened 5 days ago.
    await h.admin`
      INSERT INTO cases (organization_id, case_number, status, opened_at)
      VALUES (${orgId}, 'D-open', 'active', ${new Date(now - 5 * 86400_000)})
    `;
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
      correlationId: '00000000-0000-0000-0000-0000000000fe',
    };
  }

  it('computes the four canonical KPI snapshots', async () => {
    const result = await dashboards.computeRolling30Snapshots(ctx());
    expect(result.computed).toBe(4);

    const latest = await dashboards.listLatestSnapshots(ctx(), 'rolling_30');
    const byCode = new Map(latest.map((s) => [s.kpiCode, s]));

    expect(byCode.has('throughput')).toBe(true);
    expect(byCode.has('cycle_time')).toBe(true);
    expect(byCode.has('on_time_rate')).toBe(true);
    expect(byCode.has('utilization')).toBe(true);

    // 3 cases delivered in the window.
    expect(Number(byCode.get('throughput')!.value)).toBe(3);
    // 12-day cycle (opened 20d ago, delivered 8d ago).
    expect(Number(byCode.get('cycle_time')!.value)).toBe(12);
    // Delivered at 12 days vs promised 12 days → on time → 100%.
    expect(Number(byCode.get('on_time_rate')!.value)).toBe(100);
  });

  it('re-running UPSERTs rather than duplicating', async () => {
    await dashboards.computeRolling30Snapshots(ctx());
    await dashboards.computeRolling30Snapshots(ctx());

    const rows = await h.admin`
      SELECT kpi_code, count(*) AS n
      FROM kpi_snapshots
      WHERE organization_id = ${orgId} AND period = 'rolling_30'
      GROUP BY kpi_code
    `;
    for (const row of rows) {
      expect(Number(row['n'])).toBe(1);
    }
  });

  it('exposes a snapshot time-series for sparklines', async () => {
    const series = await dashboards.listSnapshotSeries(
      ctx(),
      'throughput',
      'rolling_30',
      12,
    );
    expect(series.length).toBeGreaterThanOrEqual(1);
  });
});
