import type { Document, DocumentLink } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

import {
  createSignedDownload,
  createSignedUpload,
  type SignedUpload,
} from '../../infrastructure/storage/supabase-storage';
import { isStorageConfigured } from '../../infrastructure/storage/storage-port';

import {
  listDocumentsForEntity,
  markDocumentProcessed,
  registerDocument,
} from './documents';

/**
 * Photo upload orchestration (docs/04-document-architecture.md). The browser
 * uploads bytes DIRECTLY to Supabase Storage via a short-lived signed URL; this
 * service only registers the document metadata + link (audited) and mints the
 * URL. Thumbnails use Supabase's on-the-fly image transform (no separate
 * pipeline / no new dependency), falling back to the original.
 *
 * Photo categories map to the before/during/after link roles from doc 04.
 */

export type PhotoCategory = 'before' | 'during' | 'after';

const ROLE_BY_CATEGORY = {
  before: 'before_photo',
  during: 'during_photo',
  after: 'after_photo',
} as const satisfies Record<PhotoCategory, DocumentLink['role']>;

export interface CreatePhotoUploadInput {
  caseId: string;
  category: PhotoCategory;
  filename: string;
  contentType?: string;
  byteSize?: number;
}

export interface PhotoUploadTicket {
  document: Document;
  upload: SignedUpload;
}

/** Register a photo's metadata and return a signed URL for the browser upload. */
export async function createPhotoUpload(
  ctx: RequestContext,
  input: CreatePhotoUploadInput,
): Promise<PhotoUploadTicket> {
  const registered = await registerDocument(ctx, {
    kind: 'photo',
    sensitivity: 'internal',
    source: 'upload',
    originalFilename: input.filename,
    ...(input.contentType ? { contentType: input.contentType } : {}),
    ...(input.byteSize != null ? { byteSize: input.byteSize } : {}),
    linkedEntityType: 'case',
    linkedEntityId: input.caseId,
    linkRole: ROLE_BY_CATEGORY[input.category],
  });

  const upload = await createSignedUpload(
    registered.storage.bucket,
    registered.storage.path,
  );

  return { document: registered.document, upload };
}

/** Mark a photo processed once the browser confirms the upload succeeded. */
export async function finalizePhoto(
  ctx: RequestContext,
  documentId: string,
): Promise<void> {
  await markDocumentProcessed(ctx, documentId);
}

export interface CasePhoto {
  document: Document;
  role: DocumentLink['role'];
  thumbUrl: string | null;
  fullUrl: string | null;
}

/**
 * List a case's photos with short-lived signed view URLs (thumbnail + full).
 * Returns null URLs when storage is not configured — the UI then shows the
 * metadata-only fallback.
 */
export async function listCasePhotos(
  ctx: RequestContext,
  caseId: string,
): Promise<CasePhoto[]> {
  const docs = await listDocumentsForEntity(ctx, 'case', caseId);
  const storageReady = isStorageConfigured();

  const out: CasePhoto[] = [];
  for (const { document, role } of docs) {
    let thumbUrl: string | null = null;
    let fullUrl: string | null = null;
    if (storageReady && document.kind === 'photo') {
      thumbUrl = await createSignedDownload(
        document.storageBucket,
        document.storagePath,
        { width: 320 },
      );
      fullUrl = await createSignedDownload(
        document.storageBucket,
        document.storagePath,
      );
    }
    out.push({ document, role, thumbUrl, fullUrl });
  }
  return out;
}
