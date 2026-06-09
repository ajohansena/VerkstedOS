import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { checklistRuns } from '@/db/schemas/quality/checklist-runs';
import { qualityDeviations } from '@/db/schemas/quality/quality-deviations';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Org-wide quality reads (Sprint 16) — the aggregate inputs the Workshop Owner
 * and Executive dashboards feed into the canonical QC calculations. Read-only;
 * the rate arithmetic stays in `qc-metrics` (SSoT).
 */

export interface OrgChecklistOutcome {
  status: 'in_progress' | 'passed' | 'failed' | 'cancelled';
}

/** Every checklist run's status across the org (for the QC failure rate). */
export async function listChecklistOutcomesForOrg(
  ctx: RequestContext,
): Promise<OrgChecklistOutcome[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ status: checklistRuns.status })
      .from(checklistRuns)
      .where(
        and(
          eq(checklistRuns.organizationId, ctx.organizationId),
          isNull(checklistRuns.deletedAt),
        ),
      );
    return rows.map((r) => ({ status: r.status }));
  });
}

export interface OrgReworkCounts {
  totalCases: number;
  reworkCases: number;
}

/**
 * Org-wide rework counts: distinct cases that needed internal rework (a
 * deviation linked to an `internal_rework` funding source) over all cases.
 */
export async function reworkCountsForOrg(
  ctx: RequestContext,
): Promise<OrgReworkCounts> {
  return withTransaction(ctx, async (tx) => {
    const totalRows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      );
    const reworkRows = await tx
      .select({
        n: sql<number>`count(distinct ${qualityDeviations.caseId})::int`,
      })
      .from(qualityDeviations)
      .where(
        and(
          eq(qualityDeviations.organizationId, ctx.organizationId),
          isNotNull(qualityDeviations.reworkFundingSourceId),
          isNull(qualityDeviations.deletedAt),
        ),
      );
    return {
      totalCases: Number(totalRows[0]?.n ?? 0),
      reworkCases: Number(reworkRows[0]?.n ?? 0),
    };
  });
}
