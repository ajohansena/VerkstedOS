import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { absenceEntries } from '@/db/schemas/workforce/absence-entries';
import { absenceTypes } from '@/db/schemas/workforce/absence-types';
import { employees } from '@/db/schemas/workforce/employees';
import type { AbsenceEntry, NewAbsenceEntry } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

export type AbsenceStatus =
  | 'requested'
  | 'approved'
  | 'declined'
  | 'cancelled';

export interface AbsenceWithEmployee {
  readonly entry: AbsenceEntry;
  readonly employeeName: string;
  readonly typeLabel: string;
  readonly affectsCapacity: boolean;
}

export async function insertAbsenceEntry(
  ctx: RequestContext,
  input: NewAbsenceEntry,
): Promise<AbsenceEntry> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(absenceEntries)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function setAbsenceStatus(
  ctx: RequestContext,
  id: string,
  status: AbsenceStatus,
  reason?: string,
): Promise<AbsenceEntry> {
  return withTransaction(ctx, async (tx) => {
    const set: Partial<AbsenceEntry> & { updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'approved') {
      set.approvedByUserId = ctx.userId;
      set.approvedAt = new Date();
      set.declinedReason = null;
    }
    if (status === 'declined') {
      set.declinedReason = reason ?? null;
    }
    const rows = await tx
      .update(absenceEntries)
      .set(set)
      .where(
        and(
          eq(absenceEntries.id, id),
          eq(absenceEntries.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new Error('ABSENCE_NOT_FOUND');
    }
    return rows[0]!;
  });
}

export async function listAbsencesForRange(
  ctx: RequestContext,
  rangeStart: Date,
  rangeEnd: Date,
  options: { onlyApproved?: boolean } = {},
): Promise<AbsenceWithEmployee[]> {
  return withTransaction(ctx, async (tx) => {
    const conds = [
      eq(absenceEntries.organizationId, ctx.organizationId),
      isNull(absenceEntries.deletedAt),
      lt(absenceEntries.startsAt, rangeEnd),
      gte(absenceEntries.endsAt, rangeStart),
    ];
    if (options.onlyApproved) {
      conds.push(eq(absenceEntries.status, 'approved'));
    }
    const rows = await tx
      .select({
        entry: absenceEntries,
        employeeName: employees.fullName,
        typeLabel: absenceTypes.label,
        affectsCapacity: absenceTypes.affectsCapacity,
      })
      .from(absenceEntries)
      .innerJoin(employees, eq(employees.id, absenceEntries.employeeId))
      .innerJoin(
        absenceTypes,
        eq(absenceTypes.id, absenceEntries.absenceTypeId),
      )
      .where(and(...conds))
      .orderBy(asc(absenceEntries.startsAt));
    return rows as AbsenceWithEmployee[];
  });
}

export async function listAbsenceRequests(
  ctx: RequestContext,
): Promise<AbsenceWithEmployee[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        entry: absenceEntries,
        employeeName: employees.fullName,
        typeLabel: absenceTypes.label,
        affectsCapacity: absenceTypes.affectsCapacity,
      })
      .from(absenceEntries)
      .innerJoin(employees, eq(employees.id, absenceEntries.employeeId))
      .innerJoin(
        absenceTypes,
        eq(absenceTypes.id, absenceEntries.absenceTypeId),
      )
      .where(
        and(
          eq(absenceEntries.organizationId, ctx.organizationId),
          eq(absenceEntries.status, 'requested'),
          isNull(absenceEntries.deletedAt),
        ),
      )
      .orderBy(asc(absenceEntries.startsAt));
    return rows as AbsenceWithEmployee[];
  });
}

/** Approved-absence windows for the given employees, intersected with the
 *  given range. Used by the capacity engine. Returns minutes per resource via
 *  the SSoT `absenceMinutesInDay` helper at the call site. */
export async function listApprovedAbsenceWindowsForEmployees(
  ctx: RequestContext,
  employeeIds: readonly string[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<
  Array<{ employeeId: string; startsAt: Date; endsAt: Date; affectsCapacity: boolean }>
> {
  if (employeeIds.length === 0) return [];
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        employeeId: absenceEntries.employeeId,
        startsAt: absenceEntries.startsAt,
        endsAt: absenceEntries.endsAt,
        affectsCapacity: absenceTypes.affectsCapacity,
      })
      .from(absenceEntries)
      .innerJoin(
        absenceTypes,
        eq(absenceTypes.id, absenceEntries.absenceTypeId),
      )
      .where(
        and(
          eq(absenceEntries.organizationId, ctx.organizationId),
          eq(absenceEntries.status, 'approved'),
          isNull(absenceEntries.deletedAt),
          lt(absenceEntries.startsAt, rangeEnd),
          gte(absenceEntries.endsAt, rangeStart),
          inArray(absenceEntries.employeeId, employeeIds as string[]),
        ),
      );
    return rows;
  });
}

export async function ensureDefaultAbsenceTypes(
  ctx: RequestContext,
): Promise<void> {
  const defaults = [
    { code: 'vacation', label: 'Ferie', isPaid: true, affectsCapacity: true },
    { code: 'sick', label: 'Sykmelding', isPaid: true, affectsCapacity: true },
    {
      code: 'training',
      label: 'Opplæring',
      isPaid: true,
      affectsCapacity: true,
    },
    { code: 'other', label: 'Annet', isPaid: false, affectsCapacity: true },
  ];
  await withTransaction(ctx, async (tx) => {
    for (const d of defaults) {
      const existing = await tx
        .select({ id: absenceTypes.id })
        .from(absenceTypes)
        .where(
          and(
            eq(absenceTypes.organizationId, ctx.organizationId),
            eq(absenceTypes.code, d.code),
            isNull(absenceTypes.deletedAt),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;
      await tx.insert(absenceTypes).values({
        organizationId: ctx.organizationId,
        code: d.code,
        label: d.label,
        isPaid: d.isPaid,
        affectsCapacity: d.affectsCapacity,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
  });
}

export async function listAbsenceTypesForOrg(
  ctx: RequestContext,
): Promise<{ id: string; code: string; label: string }[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        id: absenceTypes.id,
        code: absenceTypes.code,
        label: absenceTypes.label,
      })
      .from(absenceTypes)
      .where(
        and(
          eq(absenceTypes.organizationId, ctx.organizationId),
          isNull(absenceTypes.deletedAt),
        ),
      )
      .orderBy(asc(absenceTypes.label));
  });
}
