import { and, asc, eq } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { caseAssignments } from '@/db/schemas/case/case-assignments';
import { cases } from '@/db/schemas/case/cases';
import type { CaseAssignment } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Case assignments — temporal placement of a case at a workshop
 * (docs/03-data-model.md, multi-location). The active assignment drives
 * `cases.current_workshop_id`. Assignments repeat (A → B → A). `case:edit`.
 */

/** Internal: end the case's currently-active assignment (if any). */
export async function endActiveAssignment(
  tx: TenantTransaction,
  ctx: RequestContext,
  caseId: string,
): Promise<CaseAssignment | null> {
  const active = await tx
    .select()
    .from(caseAssignments)
    .where(
      and(
        eq(caseAssignments.organizationId, ctx.organizationId),
        eq(caseAssignments.caseId, caseId),
        eq(caseAssignments.status, 'active'),
      ),
    )
    .limit(1);
  const row = active[0];
  if (!row) return null;
  const updated = await tx
    .update(caseAssignments)
    .set({
      status: 'completed',
      endedAt: new Date(),
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(eq(caseAssignments.id, row.id))
    .returning();
  return updated[0] ?? row;
}

/** Internal: start a new active assignment + sync cases.current_workshop_id. */
export async function startAssignment(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    caseId: string;
    workshopId: string;
    role?: CaseAssignment['role'];
    notes?: string | null;
  },
): Promise<CaseAssignment> {
  const existing = await tx
    .select({ seq: caseAssignments.sequenceNo })
    .from(caseAssignments)
    .where(
      and(
        eq(caseAssignments.organizationId, ctx.organizationId),
        eq(caseAssignments.caseId, input.caseId),
      ),
    );
  const nextSeq = existing.reduce((max, r) => Math.max(max, r.seq), -1) + 1;

  const inserted = await tx
    .insert(caseAssignments)
    .values({
      organizationId: ctx.organizationId,
      caseId: input.caseId,
      workshopId: input.workshopId,
      role: input.role ?? 'other',
      sequenceNo: nextSeq,
      status: 'active',
      notes: input.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const assignment = inserted[0];
  if (!assignment) throw new Error('Failed to start assignment');

  // Sync the denormalized current workshop pointer.
  await tx
    .update(cases)
    .set({
      currentWorkshopId: input.workshopId,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cases.id, input.caseId),
        eq(cases.organizationId, ctx.organizationId),
      ),
    );

  return assignment;
}

/** Public: place a case at a workshop (ends the prior active assignment). */
export async function assignCaseToWorkshop(
  ctx: RequestContext,
  input: {
    caseId: string;
    workshopId: string;
    role?: CaseAssignment['role'];
    notes?: string;
  },
): Promise<CaseAssignment> {
  await requirePermission(ctx, 'case:edit');
  return withTransaction(ctx, async (tx) => {
    await endActiveAssignment(tx, ctx, input.caseId);
    const assignment = await startAssignment(tx, ctx, input);
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_assignments',
      entityId: assignment.id,
      after: { caseId: input.caseId, workshopId: input.workshopId },
    });
    return assignment;
  });
}

export async function listAssignments(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseAssignment[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(caseAssignments)
      .where(
        and(
          eq(caseAssignments.organizationId, ctx.organizationId),
          eq(caseAssignments.caseId, caseId),
        ),
      )
      .orderBy(asc(caseAssignments.sequenceNo));
  });
}
