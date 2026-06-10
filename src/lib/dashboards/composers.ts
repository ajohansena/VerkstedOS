import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { customers } from '@/db/schemas/customer/customers';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
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
    ...(kpis
      .filter((k) => k.code === 'on_time_rate' || k.code === 'utilization')
      .map((k) => ({
        code: k.code,
        label: k.code,
        value: k.value,
        unit: k.unit,
        health: k.value >= 80 ? 'green' : k.value >= 60 ? 'yellow' : 'red',
      })) as OwnerHealthTile[]),
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

export interface EstimatorCaseRow {
  caseId: string;
  caseNumber: string;
  registrationNumber: string | null;
  vehicleLabel: string | null;
  customerName: string | null;
  openedAt: string;
}

export interface EstimatorDashboard {
  arrivalsToday: EstimatorCaseRow[];
  awaitingInsurer: EstimatorCaseRow[];
  awaitingCustomer: EstimatorCaseRow[];
}

/**
 * Estimator dashboard (docs/11 §Estimator, Sprint 17). The three queues the
 * estimator works from: vehicles expected today, cases stuck on an open
 * insurer supplement, cases waiting on customer acceptance (draft funding
 * source still unsigned). Read-only — actions live inside the case workspace.
 */
export async function getEstimatorDashboard(
  ctx: RequestContext,
): Promise<EstimatorDashboard> {
  return withTransaction(ctx, async (tx) => {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const baseColumns = {
      caseId: cases.id,
      caseNumber: cases.caseNumber,
      registrationNumber: vehicles.registrationNumber,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      customerName: customers.name,
      openedAt: cases.openedAt,
    };

    const arrivalsRaw = await tx
      .select(baseColumns)
      .from(cases)
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
          eq(cases.status, 'intake'),
          gte(cases.openedAt, startOfToday),
        ),
      )
      .orderBy(desc(cases.openedAt))
      .limit(50);

    const awaitingInsurerRaw = await tx
      .selectDistinctOn([cases.id], baseColumns)
      .from(estimateImports)
      .innerJoin(cases, eq(cases.id, estimateImports.caseId))
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
      .where(
        and(
          eq(estimateImports.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
          eq(estimateImports.kind, 'supplement'),
          eq(estimateImports.status, 'active'),
        ),
      )
      .orderBy(cases.id, desc(estimateImports.createdAt))
      .limit(50);

    const awaitingCustomerRaw = await tx
      .selectDistinctOn([cases.id], baseColumns)
      .from(caseFundingSources)
      .innerJoin(cases, eq(cases.id, caseFundingSources.caseId))
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
      .where(
        and(
          eq(caseFundingSources.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
          eq(caseFundingSources.status, 'draft'),
          sql`${cases.status} in ('intake', 'active')`,
        ),
      )
      .orderBy(cases.id, desc(cases.openedAt))
      .limit(50);

    const toRow = (r: (typeof arrivalsRaw)[number]): EstimatorCaseRow => ({
      caseId: r.caseId,
      caseNumber: r.caseNumber,
      registrationNumber: r.registrationNumber ?? null,
      vehicleLabel:
        [r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ') || null,
      customerName: r.customerName ?? null,
      openedAt: r.openedAt.toISOString(),
    });

    return {
      arrivalsToday: arrivalsRaw.map(toRow),
      awaitingInsurer: awaitingInsurerRaw.map(toRow),
      awaitingCustomer: awaitingCustomerRaw.map(toRow),
    };
  });
}
