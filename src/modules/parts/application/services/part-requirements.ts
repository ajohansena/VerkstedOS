import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { estimateParts } from '@/db/schemas/estimating/estimate-parts';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import type { PartRequirement } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Part requirements — the spine (docs/03-data-model.md). A technician flags a
 * needed/missing part; the coordinator sources it. `parts:order` covers
 * creating and managing requirements (a flagged part IS the start of the order
 * flow). `parts:view` is read-only.
 */

export interface FlagPartInput {
  caseId: string;
  description: string;
  partNumber?: string;
  quantity?: number;
  fundingSourceId?: string | null;
  workSegmentId?: string | null;
  unitCostEstimate?: string | null;
  source?: PartRequirement['source'];
  notes?: string;
}

export async function flagPartRequirement(
  ctx: RequestContext,
  input: FlagPartInput,
): Promise<PartRequirement> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(partRequirements)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        source: input.source ?? 'manual',
        partNumber: input.partNumber ?? null,
        description: input.description,
        quantity: input.quantity != null ? String(input.quantity) : '1',
        fundingSourceId: input.fundingSourceId ?? null,
        workSegmentId: input.workSegmentId ?? null,
        unitCostEstimate: input.unitCostEstimate ?? null,
        status: 'needed',
        requestedByUserId: ctx.userId,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const requirement = inserted[0];
    if (!requirement) throw new Error('Failed to create part requirement');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'part_requirements',
      entityId: requirement.id,
      after: { caseId: input.caseId, description: input.description },
    });

    await appendLifecycleEvent(tx, ctx, {
      partRequirementId: requirement.id,
      caseId: input.caseId,
      kind: 'requirement_created',
      detail: {
        description: input.description,
        quantity: requirement.quantity,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.requirement.created',
      payload: {
        caseId: input.caseId,
        requirementId: requirement.id,
        description: input.description,
      },
    });

    return requirement;
  });
}

/** List a case's part requirements. */
export async function listPartRequirements(
  ctx: RequestContext,
  caseId: string,
): Promise<PartRequirement[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          eq(partRequirements.caseId, caseId),
          isNull(partRequirements.deletedAt),
        ),
      )
      .orderBy(partRequirements.createdAt);
  });
}

/** Cancel a requirement (e.g. no longer needed). */
export async function cancelPartRequirement(
  ctx: RequestContext,
  requirementId: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'parts:order');

  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.id, requirementId),
          eq(partRequirements.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const requirement = rows[0];
    if (!requirement) throw new Error('REQUIREMENT_NOT_FOUND');

    await tx
      .update(partRequirements)
      .set({
        status: 'cancelled',
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(partRequirements.id, requirementId));

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'part_requirements',
      entityId: requirementId,
      reason,
      after: { status: 'cancelled' },
    });

    await appendLifecycleEvent(tx, ctx, {
      partRequirementId: requirementId,
      caseId: requirement.caseId,
      kind: 'cancelled',
      detail: { reason },
    });
  });
}

/**
 * Result of an estimate-to-requirements materialization attempt.
 */
export interface MaterializeRequirementsResult {
  /** Number of new `part_requirements` rows created. */
  created: number;
  /** True when the operation was a no-op (already done, or no estimate). */
  skipped: boolean;
  /** Stable reason code when skipped; undefined on success. */
  reason?: 'already_materialized' | 'no_locked_estimate' | 'no_estimate_parts';
  /** Estimate import that requirements were derived from (when not skipped). */
  estimateImportId?: string;
}

/**
 * Materialize part requirements from the case's currently-approved locked
 * estimate. Idempotent: if ANY `part_requirements` rows already exist for the
 * case, this returns `{ skipped: true, reason: 'already_materialized' }` and
 * makes no changes. This first version intentionally defers supplement-driven
 * reconciliation (the user-approved follow-up scope).
 *
 * Trigger: this is called from the customer-acceptance paths (job-card link,
 * SMS reply) and the staff manual-acceptance path — i.e. when the repair
 * reaches the APPROVED state. It is NOT called on DBS import or on estimate
 * lock, because many estimates are revised multiple times before approval.
 *
 * Selection of the "approved estimate":
 *   - estimate_imports rows for the case with status='locked' and not soft-deleted
 *   - excluding those marked superseded
 *   - ordered by version_number DESC; the first is the canonical approved version
 *
 * Quantity (DBS verification):
 *   The DBS parser and the `estimate_parts` schema do NOT carry a quantity
 *   column. DBS convention is one row per physical part; multi-quantity is
 *   represented by multiple lines (or noted inline in the description). We
 *   therefore materialize each estimate part as one requirement with
 *   quantity = 1. If a future change extends the DBS parser to extract
 *   quantities from descriptions, this fallback is the one place to revise.
 *
 * Permission: this is an internal system trigger. The acceptance call site is
 * already authorized (case:edit for manual; token for customer paths), and the
 * materialization is a consequence of that approval. No additional permission
 * check here so the call works from `systemContext` (token-driven paths).
 */
export async function materializeRequirementsFromApprovedEstimate(
  ctx: RequestContext,
  caseId: string,
): Promise<MaterializeRequirementsResult> {
  return withTransaction(ctx, async (tx) => {
    // ── 1. Idempotency: any existing requirement on this case ───────────────
    const existing = await tx
      .select({ id: partRequirements.id })
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          eq(partRequirements.caseId, caseId),
          isNull(partRequirements.deletedAt),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return { created: 0, skipped: true, reason: 'already_materialized' };
    }

    // ── 2. Find the approved (locked, non-superseded) estimate, latest version
    const lockedRows = await tx
      .select({
        id: estimateImports.id,
        supersedesId: estimateImports.supersedesId,
      })
      .from(estimateImports)
      .where(
        and(
          eq(estimateImports.organizationId, ctx.organizationId),
          eq(estimateImports.caseId, caseId),
          eq(estimateImports.status, 'locked'),
          isNull(estimateImports.deletedAt),
        ),
      )
      .orderBy(desc(estimateImports.versionNumber));

    // Exclude any locked import that has been superseded BY another locked import.
    const supersededIds = new Set(
      lockedRows.map((r) => r.supersedesId).filter((id): id is string => !!id),
    );
    const activeLocked = lockedRows.find((r) => !supersededIds.has(r.id));
    if (!activeLocked) {
      return { created: 0, skipped: true, reason: 'no_locked_estimate' };
    }

    // ── 3. Load that estimate's parts ──────────────────────────────────────
    const parts = await tx
      .select()
      .from(estimateParts)
      .where(
        and(
          eq(estimateParts.organizationId, ctx.organizationId),
          eq(estimateParts.estimateImportId, activeLocked.id),
          isNull(estimateParts.deletedAt),
        ),
      );
    if (parts.length === 0) {
      return {
        created: 0,
        skipped: true,
        reason: 'no_estimate_parts',
        estimateImportId: activeLocked.id,
      };
    }

    // ── 4. Insert requirements (one per estimate-part line) ────────────────
    const values = parts.map((p) => ({
      organizationId: ctx.organizationId,
      caseId,
      estimatePartId: p.id,
      source: 'estimate' as const,
      partNumber: p.partNumber ?? null,
      description: p.description,
      // DBS does not provide quantity in the current parser/schema; see fn JSDoc.
      quantity: '1',
      fundingSourceId: p.fundingSourceId ?? null,
      unitCostEstimate: p.amount ?? null,
      currency: p.currency,
      status: 'needed' as const,
      requestedByUserId: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    const inserted = await tx
      .insert(partRequirements)
      .values(values)
      .returning({ id: partRequirements.id, description: partRequirements.description });

    // ── 5. Per-line lifecycle + outbox events ──────────────────────────────
    for (const req of inserted) {
      await appendLifecycleEvent(tx, ctx, {
        partRequirementId: req.id,
        caseId,
        kind: 'requirement_created',
        detail: {
          description: req.description,
          source: 'estimate',
          estimateImportId: activeLocked.id,
        },
      });

      await emitEvent(tx, ctx, {
        eventType: 'parts.requirement.created',
        payload: {
          caseId,
          requirementId: req.id,
          description: req.description,
          source: 'estimate',
        },
      });
    }

    // ── 6. Single batch audit event ────────────────────────────────────────
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'part_requirements',
      entityId: caseId,
      reason: 'Auto-materialized from approved estimate',
      after: {
        caseId,
        estimateImportId: activeLocked.id,
        createdCount: inserted.length,
      },
    });

    return {
      created: inserted.length,
      skipped: false,
      estimateImportId: activeLocked.id,
    };
  });
}
