/**
 * Absence service (Sprint 18). Approval workflow with mandatory permissions:
 * - any time:self user may request an absence for themselves
 * - admin:config (HR/admin) approves or declines
 * Approved absences feed the capacity engine via the SSoT helper
 * `absenceMinutesInDay` (production/capacity.ts).
 */

import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { withTransaction } from '@/db/client';
import type { AbsenceEntry } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  insertAbsenceEntry,
  listAbsenceRequests,
  listAbsencesForRange,
  setAbsenceStatus,
  type AbsenceWithEmployee,
} from '../../infrastructure/repositories/absence-repository';

export interface RequestAbsenceInput {
  employeeId: string;
  absenceTypeId: string;
  workshopId?: string | null;
  startsAt: Date;
  endsAt: Date;
  note?: string | null;
}

export async function requestAbsence(
  ctx: RequestContext,
  input: RequestAbsenceInput,
): Promise<AbsenceEntry> {
  await requirePermission(ctx, 'time:self');
  if (input.endsAt <= input.startsAt) {
    throw new Error('ABSENCE_RANGE_INVALID');
  }
  const entry = await insertAbsenceEntry(ctx, {
    organizationId: ctx.organizationId,
    employeeId: input.employeeId,
    absenceTypeId: input.absenceTypeId,
    workshopId: input.workshopId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    note: input.note ?? null,
    status: 'requested',
    requestedByUserId: ctx.userId,
    requestedAt: new Date(),
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'absence_entries',
      entityId: entry.id,
      after: {
        employeeId: entry.employeeId,
        startsAt: entry.startsAt.toISOString(),
        endsAt: entry.endsAt.toISOString(),
      },
    });
  });
  return entry;
}

export async function approveAbsence(
  ctx: RequestContext,
  id: string,
): Promise<AbsenceEntry> {
  await requirePermission(ctx, 'admin:config');
  const entry = await setAbsenceStatus(ctx, id, 'approved');
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'absence_entries',
      entityId: id,
      after: { status: 'approved' },
    });
  });
  return entry;
}

export async function declineAbsence(
  ctx: RequestContext,
  id: string,
  reason: string,
): Promise<AbsenceEntry> {
  await requirePermission(ctx, 'admin:config');
  if (!reason || reason.trim().length === 0) {
    throw new Error('ABSENCE_DECLINE_REASON_REQUIRED');
  }
  const entry = await setAbsenceStatus(ctx, id, 'declined', reason);
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'absence_entries',
      entityId: id,
      after: { status: 'declined', reason },
      reason,
    });
  });
  return entry;
}

export async function cancelAbsence(
  ctx: RequestContext,
  id: string,
): Promise<AbsenceEntry> {
  await requirePermission(ctx, 'time:self');
  const entry = await setAbsenceStatus(ctx, id, 'cancelled');
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'absence_entries',
      entityId: id,
      after: { status: 'cancelled' },
    });
  });
  return entry;
}

export function listPendingAbsenceRequests(
  ctx: RequestContext,
): Promise<AbsenceWithEmployee[]> {
  return listAbsenceRequests(ctx);
}

export function listAbsencesInRange(
  ctx: RequestContext,
  start: Date,
  end: Date,
): Promise<AbsenceWithEmployee[]> {
  return listAbsencesForRange(ctx, start, end);
}
