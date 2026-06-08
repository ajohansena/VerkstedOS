import { and, asc, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { checklistResponses } from '@/db/schemas/quality/checklist-responses';
import { checklistRuns } from '@/db/schemas/quality/checklist-runs';
import { checklistTemplateItems } from '@/db/schemas/quality/checklist-template-items';
import type { ChecklistResponse, ChecklistRun } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Checklist runs — performing QC against a case (docs/03-data-model.md).
 *
 * Status is DERIVED from the responses at sign-off: any failed REQUIRED item →
 * `failed`, otherwise `passed`. A failed required item must carry a comment
 * and/or a photo when the template item demands it (enforced here, not in the
 * UI). Starting/responding needs `quality:edit`; sign-off needs
 * `quality:signoff`.
 */

export class QcValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'QcValidationError';
  }
}

export async function startChecklistRun(
  ctx: RequestContext,
  input: { caseId: string; templateId: string; workSegmentId?: string | null },
): Promise<ChecklistRun> {
  await requirePermission(ctx, 'quality:edit');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(checklistRuns)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        templateId: input.templateId,
        workshopId: ctx.workshopId ?? null,
        workSegmentId: input.workSegmentId ?? null,
        status: 'in_progress',
        startedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const run = inserted[0];
    if (!run) throw new Error('Failed to start checklist run');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'checklist_runs',
      entityId: run.id,
      after: { caseId: input.caseId, templateId: input.templateId },
    });

    await emitEvent(tx, ctx, {
      eventType: 'quality.checklist.started',
      payload: { caseId: input.caseId, runId: run.id },
    });

    return run;
  });
}

export interface RespondInput {
  runId: string;
  templateItemId: string;
  result: ChecklistResponse['result'];
  comment?: string;
  photoDocumentId?: string | null;
}

/** Record (or replace) the answer to one checklist item. */
export async function respondToItem(
  ctx: RequestContext,
  input: RespondInput,
): Promise<void> {
  await requirePermission(ctx, 'quality:edit');

  await withTransaction(ctx, async (tx) => {
    // Enforce fail requirements from the template item.
    if (input.result === 'fail') {
      const itemRows = await tx
        .select()
        .from(checklistTemplateItems)
        .where(
          and(
            eq(checklistTemplateItems.id, input.templateItemId),
            eq(checklistTemplateItems.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      const item = itemRows[0];
      if (!item) throw new QcValidationError('ITEM_NOT_FOUND', 'Unknown item');
      if (item.requiresCommentOnFail && !input.comment?.trim()) {
        throw new QcValidationError(
          'COMMENT_REQUIRED',
          'Kommentar er påkrevd ved avvik.',
        );
      }
      if (item.requiresPhotoOnFail && !input.photoDocumentId) {
        throw new QcValidationError(
          'PHOTO_REQUIRED',
          'Bilde er påkrevd ved avvik.',
        );
      }
    }

    // Upsert by (run, item) — the unique constraint guarantees one answer.
    const existing = await tx
      .select({ id: checklistResponses.id })
      .from(checklistResponses)
      .where(
        and(
          eq(checklistResponses.organizationId, ctx.organizationId),
          eq(checklistResponses.checklistRunId, input.runId),
          eq(checklistResponses.templateItemId, input.templateItemId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await tx
        .update(checklistResponses)
        .set({
          result: input.result,
          comment: input.comment ?? null,
          photoDocumentId: input.photoDocumentId ?? null,
          respondedByUserId: ctx.userId,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(checklistResponses.id, existing[0].id));
    } else {
      await tx.insert(checklistResponses).values({
        organizationId: ctx.organizationId,
        checklistRunId: input.runId,
        templateItemId: input.templateItemId,
        result: input.result,
        comment: input.comment ?? null,
        photoDocumentId: input.photoDocumentId ?? null,
        respondedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
  });
}

/** Sign off a run: derive pass/fail from the responses, then lock it. */
export async function signOffRun(
  ctx: RequestContext,
  runId: string,
): Promise<ChecklistRun> {
  await requirePermission(ctx, 'quality:signoff');

  return withTransaction(ctx, async (tx) => {
    const runRows = await tx
      .select()
      .from(checklistRuns)
      .where(
        and(
          eq(checklistRuns.id, runId),
          eq(checklistRuns.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const run = runRows[0];
    if (!run) throw new Error('RUN_NOT_FOUND');

    // A required item that is unanswered or failed makes the run fail.
    const items = await tx
      .select()
      .from(checklistTemplateItems)
      .where(
        and(
          eq(checklistTemplateItems.organizationId, ctx.organizationId),
          eq(checklistTemplateItems.templateId, run.templateId),
        ),
      );
    const responses = await tx
      .select()
      .from(checklistResponses)
      .where(
        and(
          eq(checklistResponses.organizationId, ctx.organizationId),
          eq(checklistResponses.checklistRunId, runId),
        ),
      );
    const byItem = new Map(responses.map((r) => [r.templateItemId, r]));

    let failed = false;
    for (const item of items) {
      if (!item.isRequired) continue;
      const response = byItem.get(item.id);
      if (!response || response.result === 'fail') {
        failed = true;
        break;
      }
    }

    const status = failed ? 'failed' : 'passed';
    const updated = await tx
      .update(checklistRuns)
      .set({
        status,
        signedOffByUserId: ctx.userId,
        signedOffAt: new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(checklistRuns.id, runId))
      .returning();

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'checklist_runs',
      entityId: runId,
      reason: `QC signed off: ${status}`,
      after: { status },
    });

    await emitEvent(tx, ctx, {
      eventType: 'quality.checklist.signed_off',
      payload: { caseId: run.caseId, runId, status },
    });

    return updated[0] ?? run;
  });
}

export async function listChecklistRuns(
  ctx: RequestContext,
  caseId: string,
): Promise<ChecklistRun[]> {
  await requirePermission(ctx, 'quality:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(checklistRuns)
      .where(
        and(
          eq(checklistRuns.organizationId, ctx.organizationId),
          eq(checklistRuns.caseId, caseId),
        ),
      )
      .orderBy(asc(checklistRuns.createdAt));
  });
}

export async function listResponses(
  ctx: RequestContext,
  runId: string,
): Promise<ChecklistResponse[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(checklistResponses)
      .where(
        and(
          eq(checklistResponses.organizationId, ctx.organizationId),
          eq(checklistResponses.checklistRunId, runId),
        ),
      );
  });
}
