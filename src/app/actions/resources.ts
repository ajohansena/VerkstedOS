'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  archiveResource,
  createResource,
  updateResource,
  type CreateResourceInput,
  type UpdateResourceValues,
} from '@/modules/workforce/public';

/**
 * /admin/resources server actions (Sprint 22 Phase C).
 *
 * `admin:config` is enforced inside the services. UI restrictions: a
 * person Resource is auto-created from an Employee (Phase B) — the workshop
 * field is owned by the employee, not the resource. Admins re-pin people by
 * editing the employee, not the resource. Equipment + facility resources are
 * the editable resources surfaced here.
 */

export type ResourceActionResult =
  | { ok: true }
  | { ok: false; message: string };

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'UNKNOWN_ERROR';
}

export async function createResourceAction(
  input: CreateResourceInput,
): Promise<ResourceActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    await createResource(session.context, input);
    revalidatePath('/admin/resources');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function updateResourceAction(input: {
  id: string;
  values: UpdateResourceValues;
}): Promise<ResourceActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const updated = await updateResource(
      session.context,
      input.id,
      input.values,
    );
    if (!updated) return { ok: false, message: 'NOT_FOUND' };
    revalidatePath('/admin/resources');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}

export async function archiveResourceAction(input: {
  id: string;
}): Promise<ResourceActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const archived = await archiveResource(session.context, input.id);
    if (!archived) return { ok: false, message: 'NOT_FOUND' };
    revalidatePath('/admin/resources');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: normalizeError(err) };
  }
}
