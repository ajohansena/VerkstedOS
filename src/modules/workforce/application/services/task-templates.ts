import { randomUUID } from 'node:crypto';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { taskTemplates } from '@/db/schemas/workforce/task-templates';
import type { TaskTemplate } from '@/db/types';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  createOfficeTaskSystem,
  OfficeTaskValidationError,
  type OfficeTaskKind,
  type OfficeTaskPriority,
} from './office-tasks';

/**
 * Task templates — event-driven office-task generator (D3 Phase F, doc 13
 * § 16.1). A template subscribes to an outbox event type with an optional
 * shallow JSON filter; when matched, it produces an office task via
 * `createOfficeTask`, with provenance columns set for per-event idempotency.
 *
 * Generation uses a `systemContext` (bypassing user permission gates) because
 * the source event itself was already authorized — the template just unfolds
 * a downstream piece of work. The `case:edit` / `admin:config` gate still
 * applies to template CRUD.
 */

export class TaskTemplateValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TaskTemplateValidationError';
  }
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

function systemContextFor(
  organizationId: string,
  correlationId: string | null,
): RequestContext {
  return {
    userId: SYSTEM_USER_ID,
    organizationId,
    workshopId: null,
    accessibleWorkshopIds: [],
    correlationId: correlationId ?? randomUUID(),
  };
}

export type TaskTemplateDueReference =
  | 'event_time'
  | 'case_expected_arrival_at'
  | 'case_promised_delivery_at';

export interface CreateTaskTemplateInput {
  name: string;
  triggerEventType: string;
  triggerEventFilter?: Record<string, unknown> | null;
  taskKind: OfficeTaskKind;
  taskTitleTemplate: string;
  taskDescriptionTemplate?: string | null;
  dueOffsetMinutes?: number;
  dueReference?: TaskTemplateDueReference;
  defaultAssigneeResourceId?: string | null;
  defaultAssigneeUserId?: string | null;
  defaultPriority?: OfficeTaskPriority;
  workshopId?: string | null;
  isActive?: boolean;
}

export async function createTaskTemplate(
  ctx: RequestContext,
  input: CreateTaskTemplateInput,
): Promise<TaskTemplate> {
  await requirePermission(ctx, 'admin:config');
  const name = input.name.trim();
  const trigger = input.triggerEventType.trim();
  const titleTpl = input.taskTitleTemplate.trim();
  if (!name) {
    throw new TaskTemplateValidationError('EMPTY_NAME', 'Navn er påkrevd.');
  }
  if (!trigger) {
    throw new TaskTemplateValidationError(
      'EMPTY_TRIGGER',
      'Hendelsestype er påkrevd.',
    );
  }
  if (!titleTpl) {
    throw new TaskTemplateValidationError(
      'EMPTY_TITLE_TEMPLATE',
      'Tittelmal er påkrevd.',
    );
  }
  if (input.defaultAssigneeResourceId && input.defaultAssigneeUserId) {
    throw new TaskTemplateValidationError(
      'BOTH_ASSIGNEES_SET',
      'Maler kan ikke ha både standard-ressurs og standard-bruker.',
    );
  }

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(taskTemplates)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId ?? null,
        name,
        triggerEventType: trigger,
        triggerEventFilter: (input.triggerEventFilter ??
          null) as unknown as never,
        taskKind: input.taskKind,
        taskTitleTemplate: titleTpl,
        taskDescriptionTemplate: input.taskDescriptionTemplate ?? null,
        dueOffsetMinutes: input.dueOffsetMinutes ?? 0,
        dueReference: input.dueReference ?? 'event_time',
        defaultAssigneeResourceId: input.defaultAssigneeResourceId ?? null,
        defaultAssigneeUserId: input.defaultAssigneeUserId ?? null,
        defaultPriority: input.defaultPriority ?? 'normal',
        isActive: input.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const template = inserted[0];
    if (!template) throw new Error('Failed to create task template');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'task_templates',
      entityId: template.id,
      after: {
        name: template.name,
        triggerEventType: template.triggerEventType,
        taskKind: template.taskKind,
        dueOffsetMinutes: template.dueOffsetMinutes,
        dueReference: template.dueReference,
        isActive: template.isActive,
      },
    });

    return template;
  });
}

export async function listTaskTemplates(
  ctx: RequestContext,
): Promise<TaskTemplate[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(taskTemplates)
      .where(
        and(
          eq(taskTemplates.organizationId, ctx.organizationId),
          isNull(taskTemplates.deletedAt),
        ),
      )
      .orderBy(desc(taskTemplates.createdAt)),
  );
}

export async function listActiveTaskTemplatesForEvent(
  ctx: RequestContext,
  eventType: string,
): Promise<TaskTemplate[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(taskTemplates)
      .where(
        and(
          eq(taskTemplates.organizationId, ctx.organizationId),
          eq(taskTemplates.triggerEventType, eventType),
          eq(taskTemplates.isActive, true),
          isNull(taskTemplates.deletedAt),
        ),
      ),
  );
}

export async function setTaskTemplateActive(
  ctx: RequestContext,
  templateId: string,
  isActive: boolean,
): Promise<TaskTemplate> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const updated = await tx
      .update(taskTemplates)
      .set({ isActive, updatedBy: ctx.userId, updatedAt: new Date() })
      .where(
        and(
          eq(taskTemplates.id, templateId),
          eq(taskTemplates.organizationId, ctx.organizationId),
          isNull(taskTemplates.deletedAt),
        ),
      )
      .returning();
    const template = updated[0];
    if (!template) {
      throw new TaskTemplateValidationError(
        'TEMPLATE_NOT_FOUND',
        'Malen finnes ikke.',
      );
    }
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'task_templates',
      entityId: template.id,
      after: { isActive },
    });
    return template;
  });
}

// ---------------------------------------------------------------------------
// Event evaluation + generation
// ---------------------------------------------------------------------------

export interface TriggerEvent {
  /** outbox_events.id — used for idempotency. */
  eventId: string;
  organizationId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  correlationId?: string | null;
}

/**
 * Shallow equality: every key/value in `filter` must equal the same key in
 * `payload`. Missing keys never match. `null` filter / empty filter matches all.
 */
export function matchesFilter(
  filter: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!filter) return true;
  if (Object.keys(filter).length === 0) return true;
  if (!payload) return false;
  for (const [k, v] of Object.entries(filter)) {
    if (payload[k] !== v) return false;
  }
  return true;
}

function readString(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === 'string' ? v : null;
}

function readDate(
  payload: Record<string, unknown> | null,
  key: string,
): Date | null {
  const s = readString(payload, key);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveReferenceTime(
  reference: TaskTemplateDueReference,
  event: TriggerEvent,
): Date | null {
  switch (reference) {
    case 'event_time':
      return event.occurredAt;
    case 'case_expected_arrival_at':
      return readDate(event.payload, 'expectedArrivalAt');
    case 'case_promised_delivery_at':
      return readDate(event.payload, 'promisedDeliveryAt');
  }
}

/**
 * Replace `{key}` placeholders in `template` with shallow-string values from
 * `payload`. Unknown keys collapse to an empty string.
 */
export function renderTemplate(
  template: string,
  payload: Record<string, unknown> | null,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = payload?.[key];
    if (v === null || v === undefined) return '';
    return String(v);
  });
}

export interface GenerationResult {
  templatesEvaluated: number;
  tasksCreated: number;
  duplicatesSkipped: number;
}

/** True if `err` (or any wrapped cause) is a unique-violation Postgres error. */
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur !== null && cur !== undefined; i += 1) {
    if (typeof cur === 'object') {
      const obj = cur as { code?: unknown; message?: unknown; cause?: unknown };
      if (obj.code === '23505') return true;
      if (
        typeof obj.message === 'string' &&
        (obj.message.includes('office_tasks_template_event_unique') ||
          obj.message.includes('duplicate key'))
      ) {
        return true;
      }
      cur = obj.cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * For a published outbox event, fan out to every active matching template and
 * idempotently create an office task. The unique partial index on
 * (generated_from_template_id, generated_from_event_id) absorbs replays.
 */
export async function evaluateAndGenerate(
  ctx: RequestContext,
  event: TriggerEvent,
): Promise<GenerationResult> {
  const templates = await listActiveTaskTemplatesForEvent(ctx, event.eventType);
  const result: GenerationResult = {
    templatesEvaluated: templates.length,
    tasksCreated: 0,
    duplicatesSkipped: 0,
  };
  if (templates.length === 0) return result;

  const sysCtx = systemContextFor(
    event.organizationId,
    event.correlationId ?? null,
  );

  for (const template of templates) {
    const filter = template.triggerEventFilter as Record<
      string,
      unknown
    > | null;
    if (!matchesFilter(filter, event.payload)) continue;

    const refTime = resolveReferenceTime(
      template.dueReference as TaskTemplateDueReference,
      event,
    );
    const dueAt = refTime
      ? new Date(refTime.getTime() + template.dueOffsetMinutes * 60_000)
      : null;

    const title = renderTemplate(template.taskTitleTemplate, event.payload);
    const description = template.taskDescriptionTemplate
      ? renderTemplate(template.taskDescriptionTemplate, event.payload)
      : null;

    const caseId = readString(event.payload, 'caseId');

    try {
      await createOfficeTaskSystem(sysCtx, {
        title: title || template.name,
        description,
        kind: template.taskKind as OfficeTaskKind,
        priority: template.defaultPriority as OfficeTaskPriority,
        workshopId: template.workshopId,
        caseId,
        dueAt,
        assigneeResourceId: template.defaultAssigneeResourceId,
        assigneeUserId: template.defaultAssigneeUserId,
        generatedByEventType: event.eventType,
        generatedFromEventId: event.eventId,
        generatedFromTemplateId: template.id,
      });
      result.tasksCreated += 1;
    } catch (err) {
      // Unique-index collisions are expected on re-runs — Drizzle wraps the
      // underlying PostgresError in a DrizzleQueryError; inspect both the
      // outer message and the cause chain.
      if (isUniqueViolation(err)) {
        result.duplicatesSkipped += 1;
        continue;
      }
      // Validation errors (e.g. case not in org) are non-fatal — skip + log.
      if (err instanceof OfficeTaskValidationError) {
        result.duplicatesSkipped += 1;
        continue;
      }
      throw err;
    }
  }

  return result;
}
