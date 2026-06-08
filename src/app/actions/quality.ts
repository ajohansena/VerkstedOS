'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  createChecklistTemplate,
  DEFAULT_CHECKLIST_TEMPLATES,
  raiseDeviation,
  resolveDeviation,
  respondToItem,
  signOffRun,
  startChecklistRun,
  type ChecklistResponse,
  type QualityDeviation,
} from '@/modules/quality/public';

/**
 * Server actions for QC (User + Admin surfaces). The service layer enforces
 * quality:edit / quality:signoff / admin:config, the fail-requires-comment/photo
 * rules, and writes audit + outbox transactionally.
 */

export async function startChecklistAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  const templateId = String(formData.get('templateId') ?? '');
  if (!templateId) redirect(`/cases/${caseId}`);

  const run = await startChecklistRun(session.context, { caseId, templateId });
  redirect(`/cases/${caseId}/qc/${run.id}`);
}

export async function respondItemAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const runId = String(formData.get('runId') ?? '');
  const templateItemId = String(formData.get('templateItemId') ?? '');
  const result = String(
    formData.get('result') ?? 'pass',
  ) as ChecklistResponse['result'];
  const comment = String(formData.get('comment') ?? '');

  try {
    await respondToItem(session.context, {
      runId,
      templateItemId,
      result,
      ...(comment ? { comment } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feil';
    redirect(
      `/cases/${caseId}/qc/${runId}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/cases/${caseId}/qc/${runId}`);
}

export async function signOffRunAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  const runId = String(formData.get('runId') ?? '');

  try {
    await signOffRun(session.context, runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feil';
    redirect(
      `/cases/${caseId}/qc/${runId}?error=${encodeURIComponent(message)}`,
    );
  }
  redirect(`/cases/${caseId}`);
}

export async function raiseDeviationAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const severity = String(
    formData.get('severity') ?? 'minor',
  ) as QualityDeviation['severity'];
  if (!title) redirect(`/cases/${caseId}`);

  await raiseDeviation(session.context, { caseId, title, severity });
  redirect(`/cases/${caseId}`);
}

export async function resolveDeviationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const caseId = String(formData.get('caseId') ?? '');
  const deviationId = String(formData.get('deviationId') ?? '');
  await resolveDeviation(session.context, deviationId, 'Resolved from case');
  redirect(`/cases/${caseId}`);
}

/** Admin: seed the default Norwegian checklist templates (idempotent-ish). */
export async function seedDefaultChecklistsAction(): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  for (const template of DEFAULT_CHECKLIST_TEMPLATES) {
    try {
      await createChecklistTemplate(session.context, template);
    } catch {
      // Unique (org, workshop, code) — already seeded; skip.
    }
  }
  redirect('/admin/checklists');
}
