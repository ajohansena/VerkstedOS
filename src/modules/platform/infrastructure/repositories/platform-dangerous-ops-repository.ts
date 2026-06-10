import { and, desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { dangerousOperations } from '@/db/schemas/platform/dangerous-operations';
import type { DangerousOperation } from '@/db/types';

/**
 * Platform repository for the **two-person rule** queue (Sprint 20).
 * All operations run on `platform-inspector` (the Dev plane connection) and
 * sit outside tenant transactions because the queue lives in the platform.
 */

export type DangerousOperationStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export type DangerousOperationKind =
  | 'org_lock'
  | 'org_unlock'
  | 'jobs_pause'
  | 'jobs_resume'
  | 'maintenance_mode_on'
  | 'maintenance_mode_off'
  | 'data_delete'
  | 'data_restore';

export interface DangerousOperationRow {
  readonly id: string;
  readonly organizationId: string | null;
  readonly kind: DangerousOperationKind;
  readonly status: DangerousOperationStatus;
  readonly reason: string;
  readonly payload: unknown;
  readonly requestedByUserId: string;
  readonly requestedAt: Date;
  readonly approvedByUserId: string | null;
  readonly approvedAt: Date | null;
  readonly executedAt: Date | null;
  readonly outcome: string | null;
}

function toRow(r: DangerousOperation): DangerousOperationRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    kind: r.kind as DangerousOperationKind,
    status: r.status as DangerousOperationStatus,
    reason: r.reason,
    payload: r.payload,
    requestedByUserId: r.requestedByUserId,
    requestedAt: r.requestedAt,
    approvedByUserId: r.approvedByUserId,
    approvedAt: r.approvedAt,
    executedAt: r.executedAt,
    outcome: r.outcome,
  };
}

export async function listDangerousOperations(filter?: {
  status?: DangerousOperationStatus;
  organizationId?: string | null;
}): Promise<DangerousOperationRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const wheres = [];
  if (filter?.status)
    wheres.push(eq(dangerousOperations.status, filter.status));
  if (filter?.organizationId === null) {
    wheres.push(isNull(dangerousOperations.organizationId));
  } else if (filter?.organizationId) {
    wheres.push(eq(dangerousOperations.organizationId, filter.organizationId));
  }
  const rows = await db
    .select()
    .from(dangerousOperations)
    .where(wheres.length > 0 ? and(...wheres) : undefined)
    .orderBy(desc(dangerousOperations.requestedAt))
    .limit(200);
  return rows.map(toRow);
}

export async function getDangerousOperationById(
  id: string,
): Promise<DangerousOperationRow | null> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .select()
    .from(dangerousOperations)
    .where(eq(dangerousOperations.id, id))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function insertDangerousOperation(input: {
  organizationId: string | null;
  kind: DangerousOperationKind;
  reason: string;
  payload: unknown;
  requestedByUserId: string;
}): Promise<DangerousOperationRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .insert(dangerousOperations)
    .values({
      organizationId: input.organizationId,
      kind: input.kind,
      reason: input.reason,
      payload: input.payload as object,
      requestedByUserId: input.requestedByUserId,
    })
    .returning();
  return toRow(rows[0]!);
}

export async function markApproved(input: {
  id: string;
  approvedByUserId: string;
}): Promise<DangerousOperationRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .update(dangerousOperations)
    .set({
      status: 'approved',
      approvedByUserId: input.approvedByUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dangerousOperations.id, input.id),
        eq(dangerousOperations.status, 'pending_approval'),
      ),
    )
    .returning();
  return toRow(rows[0]!);
}

export async function markRejected(input: {
  id: string;
  approvedByUserId: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .update(dangerousOperations)
    .set({
      status: 'rejected',
      approvedByUserId: input.approvedByUserId,
      approvedAt: new Date(),
      outcome: input.outcome,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dangerousOperations.id, input.id),
        eq(dangerousOperations.status, 'pending_approval'),
      ),
    )
    .returning();
  return toRow(rows[0]!);
}

export async function markExecuted(input: {
  id: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .update(dangerousOperations)
    .set({
      status: 'executed',
      executedAt: new Date(),
      outcome: input.outcome,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dangerousOperations.id, input.id),
        eq(dangerousOperations.status, 'approved'),
      ),
    )
    .returning();
  return toRow(rows[0]!);
}

export async function markCancelled(input: {
  id: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .update(dangerousOperations)
    .set({
      status: 'cancelled',
      outcome: input.outcome,
      updatedAt: new Date(),
    })
    .where(eq(dangerousOperations.id, input.id))
    .returning();
  return toRow(rows[0]!);
}
