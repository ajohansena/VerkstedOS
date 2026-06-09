import type { RequestContext } from '@/lib/tenancy/context';
import { getOpsSnapshot, type OpsSnapshot } from '@/lib/operations/snapshot';
import { listLatestSnapshots } from '@/modules/dashboards/public';
import {
  accountingExportStats,
  listApprovedBases,
  type AccountingExportStats,
} from '@/modules/finance/public';
import { listOpenRequirements } from '@/modules/parts/public';
import {
  calculateQcFailureRate,
  calculateReworkRate,
  listChecklistOutcomesForOrg,
  reworkCountsForOrg,
} from '@/modules/quality/public';

/**
 * Dashboard composers (Sprint 16, docs/11). Compose the Production Manager and
 * Workshop Owner dashboards from module publics + the nightly KPI snapshots.
 * Lives outside `src/modules/` because it spans contexts — every read goes
 * through a public barrel. No business arithmetic here beyond reading the
 * already-registered calculations.
 */

export interface KpiTile {
  code: string;
  /** Numeric value as stored (interpret with `unit`). */
  value: number;
  unit: 'count' | 'days' | 'percent' | 'currency' | 'hours';
  /** Good direction for traffic-lighting. */
  direction: 'up' | 'down';
  sampleSize: number | null;
  computedAt: string | null;
}

export interface ProductionManagerDashboard {
  ops: OpsSnapshot;
  kpis: KpiTile[];
}

const KPI_META: Record<
  string,
  { unit: KpiTile['unit']; direction: KpiTile['direction'] }
> = {
  throughput: { unit: 'count', direction: 'up' },
  cycle_time: { unit: 'days', direction: 'down' },
  on_time_rate: { unit: 'percent', direction: 'up' },
  utilization: { unit: 'percent', direction: 'up' },
};

async function latestKpiTiles(ctx: RequestContext): Promise<KpiTile[]> {
  const snapshots = await listLatestSnapshots(ctx, 'rolling_30');
  return snapshots.map((s) => {
    const meta = KPI_META[s.kpiCode] ?? {
      unit: 'count' as const,
      direction: 'up' as const,
    };
    return {
      code: s.kpiCode,
      value: Number(s.value),
      unit: meta.unit,
      direction: meta.direction,
      sampleSize: s.sampleSize != null ? Number(s.sampleSize) : null,
      computedAt: s.computedAt ? s.computedAt.toISOString() : null,
    };
  });
}

/**
 * Production Manager dashboard — the live operational picture (Attention /
 * Flow / Pulse from the ops snapshot) plus the rolling-30 KPI tiles. Answers
 * "are we on track, where are the bottlenecks, who's working".
 */
export async function getProductionManagerDashboard(
  ctx: RequestContext,
): Promise<ProductionManagerDashboard> {
  const [ops, kpis] = await Promise.all([
    getOpsSnapshot(ctx),
    latestKpiTiles(ctx),
  ]);
  return { ops, kpis };
}

export interface OwnerHealthTile {
  code: string;
  label: string;
  value: number;
  unit: KpiTile['unit'];
  /** red | yellow | green from the value vs. simple thresholds. */
  health: 'red' | 'yellow' | 'green';
}

export interface WorkshopOwnerDashboard {
  kpis: KpiTile[];
  health: OwnerHealthTile[];
  finance: {
    approvedCount: number;
    approvedGross: number;
    exports: AccountingExportStats;
  };
  quality: {
    qcFailureRate: number;
    reworkRate: number;
  };
  openParts: number;
  attentionCount: number;
}

function qualityHealth(rate: number): 'red' | 'yellow' | 'green' {
  if (rate >= 0.15) return 'red';
  if (rate >= 0.07) return 'yellow';
  return 'green';
}

/**
 * Workshop Owner dashboard — health-at-a-glance tiles, the financial position
 * (approved-to-book + export status), and quality (QC failure + rework, via the
 * canonical calcs). Answers "is the business healthy this week".
 */
export async function getWorkshopOwnerDashboard(
  ctx: RequestContext,
): Promise<WorkshopOwnerDashboard> {
  const [kpis, approved, exportStats, qcRuns, rework, openParts, ops] =
    await Promise.all([
      latestKpiTiles(ctx),
      listApprovedBases(ctx),
      accountingExportStats(ctx),
      listChecklistOutcomesForOrg(ctx),
      reworkCountsForOrg(ctx),
      listOpenRequirements(ctx),
      getOpsSnapshot(ctx),
    ]);

  const qcFailureRate = calculateQcFailureRate(qcRuns).rate;
  const reworkRate = calculateReworkRate(rework).rate;

  const approvedGross = approved.reduce(
    (sum, b) => sum + Number(b.grossAmount),
    0,
  );

  const health: OwnerHealthTile[] = [
    ...kpis
      .filter((k) => k.code === 'on_time_rate' || k.code === 'utilization')
      .map((k) => ({
        code: k.code,
        label: k.code,
        value: k.value,
        unit: k.unit,
        health:
          k.value >= 80 ? 'green' : k.value >= 60 ? 'yellow' : 'red',
      })) as OwnerHealthTile[],
    {
      code: 'qc_failure_rate',
      label: 'qc_failure_rate',
      value: Math.round(qcFailureRate * 100),
      unit: 'percent',
      health: qualityHealth(qcFailureRate),
    },
    {
      code: 'rework_rate',
      label: 'rework_rate',
      value: Math.round(reworkRate * 100),
      unit: 'percent',
      health: qualityHealth(reworkRate),
    },
  ];

  return {
    kpis,
    health,
    finance: {
      approvedCount: approved.length,
      approvedGross: Math.round(approvedGross * 100) / 100,
      exports: exportStats,
    },
    quality: {
      qcFailureRate: Math.round(qcFailureRate * 100) / 100,
      reworkRate: Math.round(reworkRate * 100) / 100,
    },
    openParts: openParts.length,
    attentionCount: ops.attention.length,
  };
}
