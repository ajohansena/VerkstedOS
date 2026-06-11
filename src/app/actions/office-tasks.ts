'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  assignOfficeTask,
  cancelOfficeTask,
  completeOfficeTask,
  createOfficeTask,
  startOfficeTask,
  type CreateOfficeTaskInput,
  type OfficeTask,
  type OfficeTaskKind,
  type OfficeTaskPriority,
} from '@/modules/workforce/public';

/**
 * Office-task server actions (D3 Phase B).
 *
 * Tagged union return so the page can render an inline error without the
 * Next 16 digest screen.
 */

export type OfficeTaskActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'UNKNOWN_ERROR';
}

function revalidateForTask(task: OfficeTask): void {
  if (task.caseId) revalidatePath(`/cases/${task.caseId}`);
  revalidatePath('/production');
  revalidatePath('/admin/office-tasks');
}

export interface CreateOfficeTaskActionInput {
  title: string;
  description?: string;
  kind?: OfficeTaskKind;
  priority?: OfficeTaskPriority;
  caseId?: string;
  workshopId?: string;
  dueAt?: string;
  assigneeResourceId?: string;
  assigneeUserId?: string;
}

export async function createOfficeTaskAction(
  input: CreateOfficeTaskActionInput,
): Promise<OfficeTaskActionResult<{ taskId: string }>> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };

    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    const payload: CreateOfficeTaskInput = {
      title: input.title,
      description: input.description ?? null,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      caseId: input.caseId ?? null,
      workshopId: input.workshopId ?? null,
      dueAt,
      assigneeResourceId: input.assigneeResourceId ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
    };
    const task = await createOfficeTask(session.context, payload);
    revalidateForTask(task);
    return { ok: true, data: { taskId: task.id } };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function assignOfficeTaskAction(input: {
  taskId: string;
  resourceId?: string;
  userId?: string;
}): Promise<OfficeTaskActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const task = await assignOfficeTask(session.context, input.taskId, {
      resourceId: input.resourceId ?? null,
      userId: input.userId ?? null,
    });
    revalidateForTask(task);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function startOfficeTaskAction(input: {
  taskId: string;
}): Promise<OfficeTaskActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const task = await startOfficeTask(session.context, input.taskId);
    revalidateForTask(task);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function completeOfficeTaskAction(input: {
  taskId: string;
}): Promise<OfficeTaskActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const task = await completeOfficeTask(session.context, input.taskId);
    revalidateForTask(task);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function cancelOfficeTaskAction(input: {
  taskId: string;
  reason: string;
}): Promise<OfficeTaskActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const task = await cancelOfficeTask(
      session.context,
      input.taskId,
      input.reason,
    );
    revalidateForTask(task);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}
