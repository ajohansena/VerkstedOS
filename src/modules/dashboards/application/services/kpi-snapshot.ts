import type { RequestContext } from '@/lib/tenancy/context';
import {
  calculateAverageCycleTime,
  calculateOnTimeDeliveryRate,
  calculateThroughput,
  type DeliveredCase,
} from '@/modules/production/public';
import { calculateUtilization } from '@/modules/workforce/public';

import {
  countActiveEmployees,
  listCasesForKpis,
  sumBookedMinutes,
  upsertKpiSnapshot,
} from '../../infrastructure/repositories/kpi-repository';

/**
 * KPI snapshot service (Sprint 16). Computes the canonical KPIs for an org over
 * a rolling-30-day window and persists them as `kpi_snapshots`. Run nightly by
 * the Inngest job; also callable on demand from the Dev surface.
 *
 * Every value flows through a REGISTERED calculation (production KPIs +
 * workforce utilization) — there is no second implementation. The Single
 * Source of Truth rule is what makes the dashboards and the snapshots agree.
 */

/** Normal cycle baseline (days) used as the promised date until one exists. */
const NORMAL_REPAIR_DAYS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Standard productive minutes per employee per working day. */
const MINUTES_PER_EMPLOYEE_DAY = 450;
/** Working days in a rolling-30 window (≈ 22). */
const WORKING_DAYS_30 = 22;

export interface SnapshotResult {
  computed: number;
  periodStart: Date;
  periodEnd: Date;
}

export async function computeRolling30Snapshots(
  ctx: RequestContext,
  now: Date = new Date(),
): Promise<SnapshotResult> {
  // Normalize the window to UTC-day boundaries so re-runs within the same day
  // are idempotent (they UPSERT the same period rather than creating a new one).
  const periodEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const periodStart = new Date(periodEnd.getTime() - 30 * DAY_MS);

  const [rows, bookedMinutes, headcount] = await Promise.all([
    listCasesForKpis(ctx, periodStart, now),
    sumBookedMinutes(ctx, periodStart, now),
    countActiveEmployees(ctx),
  ]);

  const delivered: DeliveredCase[] = rows.map((r) => ({
    openedAt: r.openedAt,
    deliveredAt: r.deliveredAt,
    promisedAt: new Date(r.openedAt.getTime() + NORMAL_REPAIR_DAYS * DAY_MS),
  }));

  const throughput = calculateThroughput(delivered, periodStart, now);
  const cycle = calculateAverageCycleTime(delivered);
  const onTime = calculateOnTimeDeliveryRate(delivered);
  const utilization = calculateUtilization({
    bookedMinutes,
    availableMinutes: headcount * MINUTES_PER_EMPLOYEE_DAY * WORKING_DAYS_30,
  });

  const common = {
    period: 'rolling_30' as const,
    periodStart,
    periodEnd,
    workshopId: null,
  };

  await upsertKpiSnapshot(ctx, {
    ...common,
    kpiCode: 'throughput',
    value: throughput,
    sampleSize: throughput,
  });
  await upsertKpiSnapshot(ctx, {
    ...common,
    kpiCode: 'cycle_time',
    value: cycle.averageDays,
    sampleSize: cycle.sampleSize,
  });
  await upsertKpiSnapshot(ctx, {
    ...common,
    kpiCode: 'on_time_rate',
    value: Math.round(onTime.rate * 100),
    sampleSize: onTime.delivered,
  });
  await upsertKpiSnapshot(ctx, {
    ...common,
    kpiCode: 'utilization',
    value: utilization.percent,
    sampleSize: headcount,
  });

  return { computed: 4, periodStart, periodEnd };
}
