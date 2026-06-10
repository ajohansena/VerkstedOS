'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  createWorkshop,
  renameWorkflowState,
  updateOrganizationSettings,
} from '@/modules/identity/public';

type ActionResult = { ok: true } | { ok: false; error: string };

/** Update org settings inline from /admin (Track G). `admin:config` gated. */
export async function updateOrgSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    await updateOrganizationSettings(session.context, {
      ...(formData.get('name') ? { name: String(formData.get('name')) } : {}),
      ...(formData.has('orgNumber')
        ? { orgNumber: String(formData.get('orgNumber')) || null }
        : {}),
      ...(formData.get('locale')
        ? { locale: String(formData.get('locale')) }
        : {}),
      ...(formData.has('caseNumberFormat')
        ? { caseNumberFormat: String(formData.get('caseNumberFormat')) }
        : {}),
    });
    revalidatePath('/admin');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ERROR' };
  }
}

/** Create a workshop inline from /admin. */
export async function createWorkshopAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { ok: false, error: 'MISSING_NAME' };
    await createWorkshop(session.context, { name });
    revalidatePath('/admin');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ERROR' };
  }
}

/** Rename a workflow state from /admin/workflow. */
export async function renameWorkflowStateAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const stateId = String(formData.get('stateId') ?? '');
    const label = String(formData.get('label') ?? '').trim();
    if (!stateId || !label) return { ok: false, error: 'MISSING_FIELDS' };
    await renameWorkflowState(session.context, { stateId, label });
    revalidatePath('/admin/workflow');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ERROR' };
  }
}
