'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  createPhotoUpload,
  finalizePhoto,
  isStorageConfigured,
  registerDocument,
  type PhotoCategory,
} from '@/modules/documents/public';

/**
 * Server actions for case documents / photos (User surface).
 *
 * Two paths:
 *   - storage configured → mint a signed URL so the browser uploads bytes
 *     DIRECTLY to Supabase Storage (drag & drop, camera, multiple, progress).
 *   - storage absent      → metadata-only registration (graceful fallback).
 *
 * All paths register the document row + link (audited) via the documents
 * service. Tenant isolation + audit are enforced in the service layer.
 */

const ROLE_BY_CATEGORY = {
  before: 'before_photo',
  during: 'during_photo',
  after: 'after_photo',
} as const;

export type UploadTicket =
  | {
      ok: true;
      documentId: string;
      bucket: string;
      path: string;
      token: string;
      signedUrl: string;
    }
  | { ok: false; error: string };

/** Called per file by the PhotoUploader client to obtain a signed upload URL. */
export async function createPhotoUploadAction(input: {
  caseId: string;
  category: PhotoCategory;
  filename: string;
  contentType?: string;
  byteSize?: number;
}): Promise<UploadTicket> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: 'Ikke innlogget' };
  if (!isStorageConfigured()) {
    return { ok: false, error: 'Fillagring er ikke konfigurert' };
  }

  try {
    const ticket = await createPhotoUpload(session.context, {
      caseId: input.caseId,
      category: input.category,
      filename: input.filename,
      ...(input.contentType ? { contentType: input.contentType } : {}),
      ...(input.byteSize != null ? { byteSize: input.byteSize } : {}),
    });
    return {
      ok: true,
      documentId: ticket.document.id,
      bucket: ticket.upload.bucket,
      path: ticket.upload.path,
      token: ticket.upload.token,
      signedUrl: ticket.upload.signedUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Opplasting feilet',
    };
  }
}

/** Called after the browser confirms the bytes landed in Storage. */
export async function finalizePhotoAction(documentId: string): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  await finalizePhoto(session.context, documentId);
}

/** Metadata-only fallback (no storage): records the photo against the case. */
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
