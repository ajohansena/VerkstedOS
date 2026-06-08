import { and, asc, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { qualityDeviations } from '@/db/schemas/quality/quality-deviations';
import type { QualityDeviation } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Quality deviations (docs/03-data-model.md, CLAUDE.md § 4.7). A recorded
 * defect, optionally surfaced by a failed checklist. When rework is needed and
 * absorbed by the workshop, the deviation links the `internal_rework` funding
 * source so rework cost stays SEPARABLE (counts in the rework-rate KPI; never
 * blended into insurance cost). `quality:edit` required.
 */

export interface RaiseDeviationInput {
  caseId: string;
  title: string;
  description?: string;
  severity?: QualityDeviation['severity'];
  checklistRunId?: string | null;
  reworkFundingSourceId?: string | null;
}

export async function raiseDeviation(
  ctx: RequestContext,
  input: RaiseDeviationInput,
): Promise<QualityDeviation> {
  await requirePermission(ctx, 'quality:edit');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(qualityDeviations)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        workshopId: ctx.workshopId ?? null,
        checklistRunId: input.checklistRunId ?? null,
        title: input.title,
        description: input.description ?? null,
        severity: input.severity ?? 'minor',
        status: 'open',
        reworkFundingSourceId: input.reworkFundingSourceId ?? null,
        raisedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const deviation = inserted[0];
    if (!deviation) throw new Error('Failed to raise deviation');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'quality_deviations',
      entityId: deviation.id,
      after: {
        caseId: input.caseId,
        severity: deviation.severity,
        isRework: input.reworkFundingSourceId != null,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'quality.deviation.raised',
      payload: {
        caseId: input.caseId,
        deviationId: deviation.id,
        severity: deviation.severity,
      },
    });

    return deviation;
  });
}

export async function resolveDeviation(
  ctx: RequestContext,
  deviationId: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'quality:edit');

  await withTransaction(ctx, async (tx) => {
    await tx
      .update(qualityDeviations)
      .set({
        status: 'resolved',
        resolvedByUserId: ctx.userId,
        resolvedAt: new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(qualityDeviations.id, deviationId),
          eq(qualityDeviations.organizationId, ctx.organizationId),
        ),
      );

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'quality_deviations',
      entityId: deviationId,
      reason,
      after: { status: 'resolved' },
    });
  });
}

export async function listDeviations(
  ctx: RequestContext,
  caseId: string,
): Promise<QualityDeviation[]> {
  await requirePermission(ctx, 'quality:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(qualityDeviations)
      .where(
        and(
          eq(qualityDeviations.organizationId, ctx.organizationId),
          eq(qualityDeviations.caseId, caseId),
        ),
      )
      .orderBy(asc(qualityDeviations.createdAt));
  });
}
