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
import { ensurePersonResourceForEmployeeInTx } from './resources';

/**
 * Employee management (Admin surface). Permission: `admin:config`. Employees are
 * separate from users; not every employee logs in.
 *
 * Every new employee automatically materialises a `person` Resource in the
 * SAME transaction (doc 10 § Resource model, Sprint 22 Phase B) so the planner,
 * capacity engine and assignment surfaces see the new hire immediately. Set
 * `excludeFromPlanning: true` to opt out — useful for HR-only roles that
 * never appear in production planning (e.g. accounting, board members).
 * The auto-created resource is idempotent; existing employees keep working.
 */

export interface CreateEmployeeInput {
  fullName: string;
  workshopId?: string | null;
  employeeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: { skillCode: string; proficiency: EmployeeSkill['proficiency'] }[];
  /** Opt out of automatic Resource creation. Default: false. */
  excludeFromPlanning?: boolean;
}

export async function createEmployee(
  ctx: RequestContext,
  input: CreateEmployeeInput,
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

    if (!input.excludeFromPlanning) {
      await ensurePersonResourceForEmployeeInTx(tx, ctx, {
        employeeId: employee.id,
        name: employee.fullName,
        workshopId: employee.workshopId ?? null,
      });
    }

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
