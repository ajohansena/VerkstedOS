import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { Employee, EmployeeSkill } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  addSkill,
  insertEmployee,
} from '../../infrastructure/repositories/workforce-repository';

/**
 * Employee management (Admin surface). Permission: `admin:config`. Employees are
 * separate from users; not every employee logs in.
 */

export async function createEmployee(
  ctx: RequestContext,
  input: {
    fullName: string;
    workshopId?: string | null;
    employeeNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    skills?: { skillCode: string; proficiency: EmployeeSkill['proficiency'] }[];
  },
): Promise<Employee> {
  await requirePermission(ctx, 'admin:config');

  return withTransaction(ctx, async (tx) => {
    const employee = await insertEmployee(tx, ctx, {
      fullName: input.fullName,
      workshopId: input.workshopId ?? null,
      employeeNumber: input.employeeNumber ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });

    for (const skill of input.skills ?? []) {
      await addSkill(tx, ctx, employee.id, skill.skillCode, skill.proficiency);
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'employees',
      entityId: employee.id,
      after: { fullName: employee.fullName },
    });

    await emitEvent(tx, ctx, {
      eventType: 'workforce.employee.created',
      payload: { employeeId: employee.id },
    });

    return employee;
  });
}

/** Add a skill to an existing employee (combined-role technicians). */
export async function addEmployeeSkill(
  ctx: RequestContext,
  input: {
    employeeId: string;
    skillCode: string;
    proficiency: EmployeeSkill['proficiency'];
  },
): Promise<void> {
  await requirePermission(ctx, 'admin:config');
  await withTransaction(ctx, async (tx) => {
    await addSkill(
      tx,
      ctx,
      input.employeeId,
      input.skillCode,
      input.proficiency,
    );
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'employees',
      entityId: input.employeeId,
      after: { addedSkill: input.skillCode },
    });
  });
}
