import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { kpiDefinitions } from '@/db/schemas/dashboards/kpi-definitions';
import { kpiSnapshots } from '@/db/schemas/dashboards/kpi-snapshots';
import { workSegments } from '@/db/schemas/production/work-segments';
import { employees } from '@/db/schemas/workforce/employees';
import type { KpiDefinition, KpiSnapshot } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Dashboards / KPI repository (Sprint 16). Reads the raw inputs the KPI
 * calculations need (delivered cases, booked minutes, headcount) and persists /
 * reads `kpi_snapshots`. No business arithmetic here — only aggregation feeding
 * the registered SSoT calculations.
 */

export interface DeliveredCaseRow {
  caseId: string;
  openedAt: Date;
  deliveredAt: Date | null;
}

/** Cases opened/delivered relevant to a window (delivered within, or still open). */
export async function listCasesForKpis(
  ctx: RequestContext,
  from: Date,
  to: Date,
): Promise<DeliveredCaseRow[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        caseId: cases.id,
        openedAt: cases.openedAt,
        deliveredAt: cases.deliveredAt,
      })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
          // Delivered in the window OR opened on/before the window end.
          lte(cases.openedAt, to),
        ),
      );
    return rows.filter(
      (r) =>
        r.deliveredAt === null ||
        (r.deliveredAt >= from && r.deliveredAt <= to) ||
        r.deliveredAt > to,
    );
  });
}

/** Sum of work-segment actual minutes in the window (booked work). */
export async function sumBookedMinutes(
  ctx: RequestContext,
  from: Date,
  to: Date,
): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        total: sql<number>`coalesce(sum(${workSegments.actualMinutes}), 0)::int`,
      })
      .from(workSegments)
      .where(
        and(
          eq(workSegments.organizationId, ctx.organizationId),
          gte(workSegments.updatedAt, from),
          lte(workSegments.updatedAt, to),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  });
}

/** Count of active employees (utilization denominator basis). */
export async function countActiveEmployees(
  ctx: RequestContext,
): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, ctx.organizationId),
          isNull(employees.deletedAt),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  });
}

export interface UpsertSnapshotInput {
  workshopId?: string | null;
  kpiCode: string;
  period: 'day' | 'week' | 'month' | 'rolling_30';
  periodStart: Date;
  periodEnd: Date;
  value: number;
  sampleSize?: number | null;
}

/** Upsert one snapshot (re-run corrects rather than duplicates). */
export async function upsertKpiSnapshot(
  ctx: RequestContext,
  input: UpsertSnapshotInput,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .insert(kpiSnapshots)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId ?? null,
        kpiCode: input.kpiCode,
        period: input.period,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        value: String(input.value),
        sampleSize:
          input.sampleSize != null ? String(input.sampleSize) : null,
        computedAt: new Date(),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          kpiSnapshots.organizationId,
          kpiSnapshots.workshopId,
          kpiSnapshots.kpiCode,
          kpiSnapshots.period,
          kpiSnapshots.periodStart,
        ],
        set: {
          value: String(input.value),
          sampleSize:
            input.sampleSize != null ? String(input.sampleSize) : null,
          computedAt: new Date(),
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      });
  });
}

/** Latest snapshot per KPI code (the dashboard "as of" figures). */
export async function listLatestSnapshots(
  ctx: RequestContext,
  period: 'day' | 'week' | 'month' | 'rolling_30' = 'rolling_30',
): Promise<KpiSnapshot[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .selectDistinctOn([kpiSnapshots.kpiCode])
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.organizationId, ctx.organizationId),
          eq(kpiSnapshots.period, period),
          isNull(kpiSnapshots.workshopId),
        ),
      )
      .orderBy(kpiSnapshots.kpiCode, desc(kpiSnapshots.periodStart));
  });
}

/** Time-series for one KPI (Executive sparklines). */
export async function listSnapshotSeries(
  ctx: RequestContext,
  kpiCode: string,
  period: 'day' | 'week' | 'month' | 'rolling_30',
  limit = 12,
): Promise<KpiSnapshot[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.organizationId, ctx.organizationId),
          eq(kpiSnapshots.kpiCode, kpiCode),
          eq(kpiSnapshots.period, period),
          isNull(kpiSnapshots.workshopId),
        ),
      )
      .orderBy(desc(kpiSnapshots.periodStart))
      .limit(limit);
  });
}

export async function listKpiDefinitions(
  ctx: RequestContext,
): Promise<KpiDefinition[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(kpiDefinitions)
      .where(
        and(
          eq(kpiDefinitions.organizationId, ctx.organizationId),
          isNull(kpiDefinitions.deletedAt),
        ),
      )
      .orderBy(kpiDefinitions.category, kpiDefinitions.code);
  });
}

/**
 * Latest snapshots BY WORKSHOP (executive dashboard, Sprint 20). Returns the
 * most recent value per (workshopId, kpiCode) for the requested period. Only
 * rows that actually carry a workshopId are returned; org-level rollups stay
 * with `listLatestSnapshots`.
 */
export async function listLatestSnapshotsByWorkshop(
  ctx: RequestContext,
  period: 'day' | 'week' | 'month' | 'rolling_30' = 'rolling_30',
): Promise<KpiSnapshot[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .selectDistinctOn([kpiSnapshots.workshopId, kpiSnapshots.kpiCode])
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.organizationId, ctx.organizationId),
          eq(kpiSnapshots.period, period),
          sql`${kpiSnapshots.workshopId} is not null`,
        ),
      )
      .orderBy(
        kpiSnapshots.workshopId,
        kpiSnapshots.kpiCode,
        desc(kpiSnapshots.periodStart),
      );
  });
}

/** Cases opened/delivered for ONE workshop. */
export async function listCasesForKpisByWorkshop(
  ctx: RequestContext,
  workshopId: string,
  from: Date,
  to: Date,
): Promise<DeliveredCaseRow[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        caseId: cases.id,
        openedAt: cases.openedAt,
        deliveredAt: cases.deliveredAt,
      })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          eq(cases.currentWorkshopId, workshopId),
          isNull(cases.deletedAt),
          lte(cases.openedAt, to),
        ),
      );
    return rows.filter(
      (r) =>
        r.deliveredAt === null ||
        (r.deliveredAt >= from && r.deliveredAt <= to) ||
        r.deliveredAt > to,
    );
  });
}

/** Booked minutes for ONE workshop. */
export async function sumBookedMinutesByWorkshop(
  ctx: RequestContext,
  workshopId: string,
  from: Date,
  to: Date,
): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        total: sql<number>`coalesce(sum(${workSegments.actualMinutes}), 0)::int`,
      })
      .from(workSegments)
      .where(
        and(
          eq(workSegments.organizationId, ctx.organizationId),
          eq(workSegments.plannedWorkshopId, workshopId),
          gte(workSegments.updatedAt, from),
          lte(workSegments.updatedAt, to),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  });
}

/** Active employees for ONE workshop. */
export async function countActiveEmployeesByWorkshop(
  ctx: RequestContext,
  workshopId: string,
): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, ctx.organizationId),
          eq(employees.workshopId, workshopId),
          isNull(employees.deletedAt),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  });
}
