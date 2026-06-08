import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { caseTransfers } from '@/db/schemas/case/case-transfers';
import { cases } from '@/db/schemas/case/cases';
import { workSegments } from '@/db/schemas/production/work-segments';
import type { CaseTransfer } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { endActiveAssignment, startAssignment } from './assignments';

/**
 * Case transfers — moving a case between workshops (docs/03-data-model.md,
 * multi-location). Lifecycle: initiate (source) → accept (target, → in_transit)
 * → confirm arrival (target, → arrived). On arrival the case's active assignment
 * and `current_workshop_id` flip to the destination; operational records keep
 * their original workshop_id. `case:edit`.
 */

export class TransferValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TransferValidationError';
  }
}

/** Segment statuses that block a transfer (work in progress at the source). */
const BLOCKING_SEGMENT_STATUSES = ['in_progress', 'paused', 'blocked'] as const;

export interface InitiateTransferInput {
  caseId: string;
  toWorkshopId: string;
  transportMode?: CaseTransfer['transportMode'];
  reason?: string;
  expectedArrivalAt?: Date;
  /** Allow transfer despite in-progress segments at the source (records it). */
  allowIncompleteSegments?: boolean;
}

/**
 * Initiate a transfer from the case's current workshop to a target. Validates
 * that the target differs from the source and that no segment is mid-work at
 * the source (unless overridden). Returns the `initiated` transfer.
 */
export async function initiateTransfer(
  ctx: RequestContext,
  input: InitiateTransferInput,
): Promise<CaseTransfer> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const caseRows = await tx
      .select({ currentWorkshopId: cases.currentWorkshopId })
      .from(cases)
      .where(
        and(
          eq(cases.id, input.caseId),
          eq(cases.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const fromWorkshopId = caseRows[0]?.currentWorkshopId ?? null;

    if (fromWorkshopId === input.toWorkshopId) {
      throw new TransferValidationError(
        'SAME_WORKSHOP',
        'Saken er allerede på dette verkstedet.',
      );
    }

    // No incomplete blocking segments at the source (unless overridden).
    if (!input.allowIncompleteSegments) {
      const blocking = await tx
        .select({ id: workSegments.id })
        .from(workSegments)
        .where(
          and(
            eq(workSegments.organizationId, ctx.organizationId),
            eq(workSegments.caseId, input.caseId),
            inArray(workSegments.status, [...BLOCKING_SEGMENT_STATUSES]),
          ),
        )
        .limit(1);
      if (blocking.length > 0) {
        throw new TransferValidationError(
          'BLOCKING_SEGMENTS',
          'Saken har segmenter under arbeid. Fullfør eller overstyr.',
        );
      }
    }

    const inserted = await tx
      .insert(caseTransfers)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        fromWorkshopId,
        toWorkshopId: input.toWorkshopId,
        status: 'initiated',
        transportMode: input.transportMode ?? 'drive',
        reason: input.reason ?? null,
        initiatedByUserId: ctx.userId,
        expectedArrivalAt: input.expectedArrivalAt ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const transfer = inserted[0];
    if (!transfer) throw new Error('Failed to initiate transfer');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_transfers',
      entityId: transfer.id,
      after: { caseId: input.caseId, toWorkshopId: input.toWorkshopId },
    });

    // Notifies the receiving workshop (consumed by the yard view / inbox).
    await emitEvent(tx, ctx, {
      eventType: 'case.transfer.initiated',
      payload: {
        caseId: input.caseId,
        transferId: transfer.id,
        toWorkshopId: input.toWorkshopId,
        fromWorkshopId,
      },
    });

    return transfer;
  });
}

/** Target accepts the transfer → in_transit (dispatched). */
export async function acceptTransfer(
  ctx: RequestContext,
  transferId: string,
): Promise<CaseTransfer> {
  await requirePermission(ctx, 'case:edit');
  return withTransaction(ctx, async (tx) => {
    const updated = await tx
      .update(caseTransfers)
      .set({
        status: 'in_transit',
        acceptedByUserId: ctx.userId,
        dispatchedAt: new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(caseTransfers.id, transferId),
          eq(caseTransfers.organizationId, ctx.organizationId),
          eq(caseTransfers.status, 'initiated'),
        ),
      )
      .returning();
    const transfer = updated[0];
    if (!transfer)
      throw new TransferValidationError(
        'NOT_INITIATED',
        'Overføringen kan ikke aksepteres.',
      );

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'case_transfers',
      entityId: transferId,
      reason: 'Transfer accepted',
      after: { status: 'in_transit' },
    });
    await emitEvent(tx, ctx, {
      eventType: 'case.transfer.in_transit',
      payload: { caseId: transfer.caseId, transferId },
    });
    return transfer;
  });
}

/**
 * Target confirms arrival → arrived. Flips the case's active assignment +
 * `current_workshop_id` to the destination (operational records keep theirs).
 */
export async function confirmArrival(
  ctx: RequestContext,
  transferId: string,
  role?:
    | 'body'
    | 'paint'
    | 'mechanical'
    | 'calibration'
    | 'assembly'
    | 'qc'
    | 'storage'
    | 'other',
): Promise<CaseTransfer> {
  await requirePermission(ctx, 'case:edit');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(caseTransfers)
      .where(
        and(
          eq(caseTransfers.id, transferId),
          eq(caseTransfers.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const transfer = rows[0];
    if (!transfer)
      throw new TransferValidationError('NOT_FOUND', 'Overføring ikke funnet.');
    if (transfer.status !== 'in_transit' && transfer.status !== 'initiated') {
      throw new TransferValidationError(
        'NOT_IN_TRANSIT',
        'Overføringen er ikke under transport.',
      );
    }

    const updated = await tx
      .update(caseTransfers)
      .set({
        status: 'arrived',
        arrivedConfirmedByUserId: ctx.userId,
        arrivedAt: new Date(),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(caseTransfers.id, transferId))
      .returning();

    // Flip the case to the destination workshop (new assignment).
    await endActiveAssignment(tx, ctx, transfer.caseId);
    await startAssignment(tx, ctx, {
      caseId: transfer.caseId,
      workshopId: transfer.toWorkshopId,
      ...(role ? { role } : {}),
    });

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'case_transfers',
      entityId: transferId,
      reason: 'Arrival confirmed',
      after: { status: 'arrived', toWorkshopId: transfer.toWorkshopId },
    });
    await emitEvent(tx, ctx, {
      eventType: 'case.transfer.arrived',
      payload: {
        caseId: transfer.caseId,
        transferId,
        toWorkshopId: transfer.toWorkshopId,
      },
    });
    return updated[0] ?? transfer;
  });
}

export async function cancelTransfer(
  ctx: RequestContext,
  transferId: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'case:edit');
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(caseTransfers)
      .set({
        status: 'cancelled',
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(caseTransfers.id, transferId),
          eq(caseTransfers.organizationId, ctx.organizationId),
        ),
      );
    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'case_transfers',
      entityId: transferId,
      reason,
      after: { status: 'cancelled' },
    });
  });
}

export async function listTransfers(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseTransfer[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(caseTransfers)
      .where(
        and(
          eq(caseTransfers.organizationId, ctx.organizationId),
          eq(caseTransfers.caseId, caseId),
        ),
      )
      .orderBy(asc(caseTransfers.initiatedAt));
  });
}

export interface InboundTransfer {
  transfer: CaseTransfer;
  caseNumber: string;
}

/** Inbound transfers heading to a workshop — the yard view. */
export async function listInboundTransfers(
  ctx: RequestContext,
  toWorkshopId: string,
): Promise<InboundTransfer[]> {
  await requirePermission(ctx, 'case:view');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ transfer: caseTransfers, caseNumber: cases.caseNumber })
      .from(caseTransfers)
      .innerJoin(cases, eq(cases.id, caseTransfers.caseId))
      .where(
        and(
          eq(caseTransfers.organizationId, ctx.organizationId),
          eq(caseTransfers.toWorkshopId, toWorkshopId),
          inArray(caseTransfers.status, ['initiated', 'in_transit']),
        ),
      )
      .orderBy(desc(caseTransfers.initiatedAt));
    return rows.map((r) => ({
      transfer: r.transfer,
      caseNumber: r.caseNumber,
    }));
  });
}
