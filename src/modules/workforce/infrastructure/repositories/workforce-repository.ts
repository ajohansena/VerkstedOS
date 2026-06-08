import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { clockSessions } from '@/db/schemas/workforce/clock-sessions';
import { employeeSkills } from '@/db/schemas/workforce/employee-skills';
import { employees } from '@/db/schemas/workforce/employees';
import { timeEntries } from '@/db/schemas/workforce/time-entries';
import type {
  ClockSession,
  Employee,
  EmployeeSkill,
  TimeEntry,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Workforce read/write repository (org-scoped).
 */

export async function insertEmployee(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: {
    fullName: string;
    workshopId?: string | null;
    userId?: string | null;
    employeeNumber?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<Employee> {
  const rows = await tx
    .insert(employees)
    .values({
      organizationId: ctx.organizationId,
      fullName: values.fullName,
      workshopId: values.workshopId ?? ctx.workshopId ?? null,
      userId: values.userId ?? null,
      employeeNumber: values.employeeNumber ?? null,
      email: values.email ?? null,
      phone: values.phone ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const employee = rows[0];
  if (!employee) throw new Error('Failed to insert employee');
  return employee;
}

export async function listEmployees(ctx: RequestContext): Promise<Employee[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, ctx.organizationId),
          isNull(employees.deletedAt),
        ),
      )
      .orderBy(employees.fullName);
  });
}

export async function findEmployeeById(
  ctx: RequestContext,
  id: string,
): Promise<Employee | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, id),
          eq(employees.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function addSkill(
  tx: TenantTransaction,
  ctx: RequestContext,
  employeeId: string,
  skillCode: string,
  proficiency: EmployeeSkill['proficiency'],
): Promise<void> {
  await tx
    .insert(employeeSkills)
    .values({
      organizationId: ctx.organizationId,
      employeeId,
      skillCode,
      proficiency,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .onConflictDoNothing({
      target: [employeeSkills.employeeId, employeeSkills.skillCode],
    });
}

export async function listSkills(
  ctx: RequestContext,
  employeeId: string,
): Promise<EmployeeSkill[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(employeeSkills)
      .where(
        and(
          eq(employeeSkills.organizationId, ctx.organizationId),
          eq(employeeSkills.employeeId, employeeId),
          isNull(employeeSkills.deletedAt),
        ),
      );
  });
}

/** Currently open clock session for an employee, if any. */
export async function findOpenSession(
  ctx: RequestContext,
  employeeId: string,
  tx?: TenantTransaction,
): Promise<ClockSession | null> {
  const run = async (t: TenantTransaction) => {
    const rows = await t
      .select()
      .from(clockSessions)
      .where(
        and(
          eq(clockSessions.organizationId, ctx.organizationId),
          eq(clockSessions.employeeId, employeeId),
          eq(clockSessions.status, 'open'),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  };
  return tx ? run(tx) : withTransaction(ctx, run);
}

export interface WorkingNow {
  readonly employeeId: string;
  readonly fullName: string;
  readonly caseId: string | null;
  readonly segmentCode: string | null;
  readonly startedAt: Date;
}

/** Who is currently clocked in (manager "who's working" view). */
export async function listWorkingNow(
  ctx: RequestContext,
): Promise<WorkingNow[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        employeeId: employees.id,
        fullName: employees.fullName,
        caseId: clockSessions.caseId,
        segmentCode: clockSessions.segmentCode,
        startedAt: clockSessions.startedAt,
      })
      .from(clockSessions)
      .innerJoin(employees, eq(employees.id, clockSessions.employeeId))
      .where(
        and(
          eq(clockSessions.organizationId, ctx.organizationId),
          eq(clockSessions.status, 'open'),
        ),
      )
      .orderBy(clockSessions.startedAt);
  });
}

/** Time entries for an employee, newest first. */
export async function listTimeEntries(
  ctx: RequestContext,
  employeeId: string,
  limit = 50,
): Promise<TimeEntry[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, ctx.organizationId),
          eq(timeEntries.employeeId, employeeId),
        ),
      )
      .orderBy(desc(timeEntries.startedAt))
      .limit(limit);
  });
}
