import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { clockSessions } from '@/db/schemas/workforce/clock-sessions';
import { timeEntries } from '@/db/schemas/workforce/time-entries';
import type { ClockSession } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { findOpenSession } from '../../infrastructure/repositories/workforce-repository';

/**
 * Clock-in / clock-out (docs/03-data-model.md, docs/10 § Production queue).
 *
 * GUARDRAIL LINK (Sprint 9 → 10): a clock-in is optionally tied to a case +
 * segment code. In Sprint 10 this is what lets technician activity DRIVE
 * production progress (clock into 'paint_preparation' ⇒ that segment is active ⇒
 * the case's status projection reflects it). Sprint 9 records the activity;
 * Sprint 10 wires it to the segment/transition machine.
 *
 * One OPEN session per employee is enforced by a partial unique index; this
 * service also checks first to give a friendly error. Permission: `time:self`.
 */

export async function clockIn(
  ctx: RequestContext,
  input: {
    employeeId: string;
    caseId?: string | null;
    segmentCode?: string | null;
    workshopId?: string | null;
  },
): Promise<ClockSession> {
  await requirePermission(ctx, 'time:self');

  return withTransaction(ctx, async (tx) => {
    const open = await findOpenSession(ctx, input.employeeId, tx);
    if (open) {
      throw new Error('ALREADY_CLOCKED_IN');
    }

    const rows = await tx
      .insert(clockSessions)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId ?? ctx.workshopId ?? null,
        employeeId: input.employeeId,
        caseId: input.caseId ?? null,
        segmentCode: input.segmentCode ?? null,
        status: 'open',
      })
      .returning();
    const session = rows[0];
    if (!session) throw new Error('Failed to clock in');

    await emitEvent(tx, ctx, {
      eventType: 'workforce.clock.in',
      payload: {
        employeeId: input.employeeId,
        clockSessionId: session.id,
        caseId: input.caseId ?? null,
        segmentCode: input.segmentCode ?? null,
      },
    });

    return session;
  });
}

export async function clockOut(
  ctx: RequestContext,
  employeeId: string,
): Promise<{ durationMinutes: number }> {
  await requirePermission(ctx, 'time:self');

  return withTransaction(ctx, async (tx) => {
    const open = await findOpenSession(ctx, employeeId, tx);
    if (!open) {
      throw new Error('NOT_CLOCKED_IN');
    }

    const endedAt = new Date();
    const durationMinutes = Math.max(
      0,
      Math.round((endedAt.getTime() - open.startedAt.getTime()) / 60000),
    );

    await tx
      .update(clockSessions)
      .set({ status: 'closed', endedAt })
      .where(
        and(
          eq(clockSessions.id, open.id),
          eq(clockSessions.organizationId, ctx.organizationId),
        ),
      );

    // The clock-out produces the original (event-tier) time entry.
    await tx.insert(timeEntries).values({
      organizationId: ctx.organizationId,
      workshopId: open.workshopId,
      employeeId,
      caseId: open.caseId,
      clockSessionId: open.id,
      segmentCode: open.segmentCode,
      kind: 'work',
      startedAt: open.startedAt,
      endedAt,
      durationMinutes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await emitEvent(tx, ctx, {
      eventType: 'workforce.clock.out',
      payload: { employeeId, clockSessionId: open.id, durationMinutes },
    });

    return { durationMinutes };
  });
}

/**
 * Correct a time entry (full-audited). A correction is a NEW row referencing the
 * original via `corrects_entry_id` — the original is never edited in place.
 * Permission: `time:correct`.
 */
export async function correctTimeEntry(
  ctx: RequestContext,
  input: {
    originalEntryId: string;
    employeeId: string;
    durationMinutes: number;
    reason: string;
    caseId?: string | null;
    segmentCode?: string | null;
  },
): Promise<void> {
  await requirePermission(ctx, 'time:correct');
  if (!input.reason.trim()) {
    throw new Error('A reason is required for a time correction.');
  }

  await withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(timeEntries)
      .values({
        organizationId: ctx.organizationId,
        employeeId: input.employeeId,
        caseId: input.caseId ?? null,
        segmentCode: input.segmentCode ?? null,
        kind: 'correction',
        durationMinutes: input.durationMinutes,
        correctsEntryId: input.originalEntryId,
        note: input.reason,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: timeEntries.id });

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'time_entries',
      entityId: inserted[0]?.id ?? input.originalEntryId,
      reason: input.reason,
      after: {
        correctsEntryId: input.originalEntryId,
        durationMinutes: input.durationMinutes,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'workforce.time.corrected',
      payload: {
        originalEntryId: input.originalEntryId,
        employeeId: input.employeeId,
      },
    });
  });
}
