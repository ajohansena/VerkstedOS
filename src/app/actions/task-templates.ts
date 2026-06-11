'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import { DEFAULT_TASK_TEMPLATES } from '@/lib/seed/default-task-templates';
import {
  createTaskTemplate,
  setTaskTemplateActive,
  type CreateTaskTemplateInput,
} from '@/modules/workforce/public';

export type TaskTemplateActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'UNKNOWN_ERROR';
}

export async function createTaskTemplateAction(
  input: CreateTaskTemplateInput,
): Promise<TaskTemplateActionResult<{ templateId: string }>> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const template = await createTaskTemplate(session.context, input);
    revalidatePath('/admin/task-templates');
    return { ok: true, data: { templateId: template.id } };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function setTaskTemplateActiveAction(input: {
  templateId: string;
  isActive: boolean;
}): Promise<TaskTemplateActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    await setTaskTemplateActive(
      session.context,
      input.templateId,
      input.isActive,
    );
    revalidatePath('/admin/task-templates');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

/**
 * Seed the org with the five default Norwegian templates. Idempotent in the
 * "do no harm" sense: each call creates a new copy — admins are expected to
 * call this once at setup time. (The DB-side unique index for tasks does NOT
 * prevent duplicate templates; that's by design — multi-workshop orgs may want
 * per-workshop variations.)
 */
export async function seedDefaultTaskTemplatesAction(): Promise<
  TaskTemplateActionResult<{ created: number }>
> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    let created = 0;
    for (const spec of DEFAULT_TASK_TEMPLATES) {
      const { key: _key, ...input } = spec;
      void _key;
      await createTaskTemplate(session.context, input);
      created += 1;
    }
    revalidatePath('/admin/task-templates');
    return { ok: true, data: { created } };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}
