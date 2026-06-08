'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { registerDocument } from '@/modules/documents/public';

/**
 * Server actions for case documents (User surface). Registers a photo's
 * metadata against the case with a before/during/after role. The physical
 * upload to Supabase Storage is a follow-up (gated on storage config); this
 * records the document row + link so the gallery and timeline work.
 */

const ROLE_BY_CATEGORY = {
  before: 'before_photo',
  during: 'during_photo',
  after: 'after_photo',
} as const;

export async function registerCasePhotoAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const filename = String(formData.get('filename') ?? '').trim();
  const category = String(formData.get('category') ?? 'before');
  const role =
    ROLE_BY_CATEGORY[category as keyof typeof ROLE_BY_CATEGORY] ??
    'before_photo';

  if (!filename) {
    redirect(`/cases/${caseId}?error=${encodeURIComponent('Mangler filnavn')}`);
  }

  try {
    await registerDocument(session.context, {
      kind: 'photo',
      sensitivity: 'internal',
      originalFilename: filename,
      linkedEntityType: 'case',
      linkedEntityId: caseId,
      linkRole: role,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Kunne ikke registrere bilde';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}`);
}
