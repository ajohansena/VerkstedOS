import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { cases } from '@/db/schemas/case/cases';
import { officeTasks } from '@/db/schemas/workforce/office-tasks';
import { resources } from '@/db/schemas/workforce/resources';
import type { OfficeTask } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Office-task service (D3 Phase B, doc 13 § 10 + § 16.1).
 *
 * Permission policy:
 *   - case-linked tasks: `case:edit` (any receptionist / coordinator)
 *   - non-case tasks: `admin:config` (workshop / org configuration territory)
 *   - assigning a resource: `production:plan` (resource-planning gate)
 *   - completing / cancelling: `case:edit` (a task owner can finish their work)
 *
 * Mutations write audit + outbox event in the same transaction.
 *
 * Office tasks are NEVER summed into case cost (CLAUDE.md § 4.7 TakstKontroll
 * compatibility) — they're operational, not financial. The capacity engine
 * also ignores them (doc 13 § 10 — they're plannable but don't book minutes).
 */

export class OfficeTaskValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OfficeTaskValidationError';
  }
}

export type OfficeTaskKind =
  | 'order_parts'
  | 'customer_call'
  | 'insurer_followup'
  | 'rental_booking'
  | 'invoice_prep'
  | 'customer_followup'
  | 'documentation'
  | 'other';

export type OfficeTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateOfficeTaskInput {
  title: string;
  description?: string | null;
  kind?: OfficeTaskKind;
  priority?: OfficeTaskPriority;
  workshopId?: string | null;
  caseId?: string | null;
  dueAt?: Date | null;
  assigneeResourceId?: string | null;
  assigneeUserId?: string | null;
  /** Phase F provenance — never set by user input. */
  generatedByEventType?: string | null;
  generatedFromEventId?: string | null;
  generatedFromTemplateId?: string | null;
}

function assertSingleAssignee(input: {
  assigneeResourceId?: string | null;
  assigneeUserId?: string | null;
}): void {
  if (input.assigneeResourceId && input.assigneeUserId) {
    throw new OfficeTaskValidationError(
      'BOTH_ASSIGNEES_SET',
      'En oppgave kan ikke tildeles både en ressurs og en bruker samtidig.',
    );
  }
}

/**
 * System-context variant: same insert + audit + outbox flow as
 * `createOfficeTask`, but without the `case:edit` / `admin:config` permission
 * gate. Used by the template-driven generator (D3 Phase F) — the source event
 * itself was already authorized, so the generated task is system-emitted.
 *
 * NOT exported outside the module — only callers inside `task-templates.ts`
 * should use it.
 */
export async function createOfficeTaskSystem(
  ctx: RequestContext,
  input: CreateOfficeTaskInput,
): Promise<OfficeTask> {
  assertSingleAssignee(input);
  const title = input.title.trim();
  if (!title) {
    throw new OfficeTaskValidationError('EMPTY_TITLE', 'Tittel er påkrevd.');
  }
  return insertOfficeTaskInTx(ctx, input, title);
}

export async function createOfficeTask(
  ctx: RequestContext,
  input: CreateOfficeTaskInput,
): Promise<OfficeTask> {
  // Permission depends on whether the task is case-linked.
  if (input.caseId) {
    await requirePermission(ctx, 'case:edit');
  } else {
    await requirePermission(ctx, 'admin:config');
  }
  assertSingleAssignee(input);
  const title = input.title.trim();
  if (!title) {
    throw new OfficeTaskValidationError('EMPTY_TITLE', 'Tittel er påkrevd.');
  }
  return insertOfficeTaskInTx(ctx, input, title);
}

async function insertOfficeTaskInTx(
  ctx: RequestContext,
  input: CreateOfficeTaskInput,
  title: string,
): Promise<OfficeTask> {
  return withTransaction(ctx, async (tx) => {
    if (input.caseId) {
      const caseRow = await tx
        .select({ id: cases.id })
        .from(cases)
        .where(
          and(
            eq(cases.id, input.caseId),
            eq(cases.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (caseRow.length === 0) {
        throw new OfficeTaskValidationError(
          'CASE_NOT_FOUND',
          'Saken finnes ikke i denne organisasjonen.',
        );
      }
    }

    if (input.assigneeResourceId) {
      const resourceRow = await tx
        .select({ id: resources.id })
        .from(resources)
        .where(
          and(
            eq(resources.id, input.assigneeResourceId),
            eq(resources.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (resourceRow.length === 0) {
        throw new OfficeTaskValidationError(
          'RESOURCE_NOT_FOUND',
          'Tildelt ressurs finnes ikke i denne organisasjonen.',
        );
      }
    }

    const inserted = await tx
      .insert(officeTasks)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId ?? null,
        caseId: input.caseId ?? null,
        title,
        description: input.description ?? null,
        kind: input.kind ?? 'other',
        priority: input.priority ?? 'normal',
        status: 'open',
        dueAt: input.dueAt ?? null,
        assigneeResourceId: input.assigneeResourceId ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        generatedByEventType: input.generatedByEventType ?? null,
        generatedFromEventId: input.generatedFromEventId ?? null,
        generatedFromTemplateId: input.generatedFromTemplateId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const task = inserted[0];
    if (!task) throw new Error('Failed to create office task');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'office_tasks',
      entityId: task.id,
      after: {
        caseId: task.caseId,
        workshopId: task.workshopId,
        kind: task.kind,
        priority: task.priority,
        dueAt: task.dueAt,
        assigneeResourceId: task.assigneeResourceId,
        assigneeUserId: task.assigneeUserId,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'workforce.office_task.created',
      payload: {
        taskId: task.id,
        caseId: task.caseId,
        workshopId: task.workshopId,
        kind: task.kind,
        priority: task.priority,
        dueAt: task.dueAt,
      },
    });

    return task;
  });
}

async function loadTaskForUpdate(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  taskId: string,
): Promise<OfficeTask> {
  const rows = await tx
    .select()
    .from(officeTasks)
    .where(
      and(
        eq(officeTasks.id, taskId),
        eq(officeTasks.organizationId, ctx.organizationId),
        isNull(officeTasks.deletedAt),
      ),
    )
    .limit(1);
  const task = rows[0];
  if (!task) {
    throw new OfficeTaskValidationError(
      'TASK_NOT_FOUND',
      'Oppgaven finnes ikke.',
    );
  }
  return task;
}

export interface AssignOfficeTaskInput {
  resourceId?: string | null;
  userId?: string | null;
}

export async function assignOfficeTask(
  ctx: RequestContext,
  taskId: string,
  input: AssignOfficeTaskInput,
): Promise<OfficeTask> {
  await requirePermission(ctx, 'production:plan');
  assertSingleAssignee({
    assigneeResourceId: input.resourceId ?? null,
    assigneeUserId: input.userId ?? null,
  });

  return withTransaction(ctx, async (tx) => {
    const task = await loadTaskForUpdate(tx, ctx, taskId);
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new OfficeTaskValidationError(
        'INVALID_TRANSITION',
        `Kan ikke tildele en oppgave i status «${task.status}».`,
      );
    }

    if (input.resourceId) {
      const resourceRow = await tx
        .select({ id: resources.id })
        .from(resources)
        .where(
          and(
            eq(resources.id, input.resourceId),
            eq(resources.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (resourceRow.length === 0) {
        throw new OfficeTaskValidationError(
          'RESOURCE_NOT_FOUND',
          'Ressursen finnes ikke.',
        );
      }
    }

    const updated = await tx
      .update(officeTasks)
      .set({
        assigneeResourceId: input.resourceId ?? null,
        assigneeUserId: input.userId ?? null,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(officeTasks.id, taskId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to assign office task');

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'office_tasks',
      entityId: taskId,
      before: {
        assigneeResourceId: task.assigneeResourceId,
        assigneeUserId: task.assigneeUserId,
      },
      after: {
        assigneeResourceId: next.assigneeResourceId,
        assigneeUserId: next.assigneeUserId,
      },
    });
    await emitEvent(tx, ctx, {
      eventType: 'workforce.office_task.assigned',
      payload: {
        taskId,
        caseId: next.caseId,
        assigneeResourceId: next.assigneeResourceId,
        assigneeUserId: next.assigneeUserId,
      },
    });
    return next;
  });
}

/** Move from open → in_progress. Idempotent. */
export async function startOfficeTask(
  ctx: RequestContext,
  taskId: string,
): Promise<OfficeTask> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const task = await loadTaskForUpdate(tx, ctx, taskId);
    if (task.status === 'in_progress') return task;
    if (task.status !== 'open') {
      throw new OfficeTaskValidationError(
        'INVALID_TRANSITION',
        `Kan ikke starte en oppgave i status «${task.status}».`,
      );
    }
    const updated = await tx
      .update(officeTasks)
      .set({
        status: 'in_progress',
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(officeTasks.id, taskId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to start task');
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'office_tasks',
      entityId: taskId,
      before: { status: task.status },
      after: { status: 'in_progress' },
    });
    await emitEvent(tx, ctx, {
      eventType: 'workforce.office_task.started',
      payload: { taskId, caseId: next.caseId },
    });
    return next;
  });
}

export async function completeOfficeTask(
  ctx: RequestContext,
  taskId: string,
): Promise<OfficeTask> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const task = await loadTaskForUpdate(tx, ctx, taskId);
    if (task.status === 'completed') return task;
    if (task.status === 'cancelled') {
      throw new OfficeTaskValidationError(
        'INVALID_TRANSITION',
        'Kan ikke fullføre en kansellert oppgave.',
      );
    }
    const now = new Date();
    const updated = await tx
      .update(officeTasks)
      .set({
        status: 'completed',
        completedAt: now,
        completedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(officeTasks.id, taskId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to complete task');
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'office_tasks',
      entityId: taskId,
      before: { status: task.status },
      after: { status: 'completed', completedAt: now },
    });
    await emitEvent(tx, ctx, {
      eventType: 'workforce.office_task.completed',
      payload: { taskId, caseId: next.caseId, completedAt: now },
    });
    return next;
  });
}

export async function cancelOfficeTask(
  ctx: RequestContext,
  taskId: string,
  reason: string,
): Promise<OfficeTask> {
  await requirePermission(ctx, 'case:edit');
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new OfficeTaskValidationError(
      'REASON_REQUIRED',
      'Begrunnelse er påkrevd ved kansellering.',
    );
  }

  return withTransaction(ctx, async (tx) => {
    const task = await loadTaskForUpdate(tx, ctx, taskId);
    if (task.status === 'cancelled') return task;
    if (task.status === 'completed') {
      throw new OfficeTaskValidationError(
        'INVALID_TRANSITION',
        'Kan ikke kansellere en fullført oppgave.',
      );
    }
    const now = new Date();
    const updated = await tx
      .update(officeTasks)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelledByUserId: ctx.userId,
        cancelledReason: trimmed,
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(officeTasks.id, taskId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to cancel task');
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'office_tasks',
      entityId: taskId,
      before: { status: task.status },
      after: { status: 'cancelled', reason: trimmed },
    });
    await emitEvent(tx, ctx, {
      eventType: 'workforce.office_task.cancelled',
      payload: { taskId, caseId: next.caseId, reason: trimmed },
    });
    return next;
  });
}
