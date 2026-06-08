import { randomUUID } from 'node:crypto';

import type { Document } from '@/db/types';

/**
 * Storage port (docs/04-document-architecture.md § Storage strategy).
 *
 * Physical bytes live in Supabase Storage, organized into buckets by
 * SENSITIVITY class (not by document kind), so Storage RLS + lifecycle rules
 * stay uniform. This port is the single seam the documents service uses; the
 * Supabase implementation is wired only when Storage is configured. Until then
 * `isStorageConfigured()` is false and the service degrades gracefully (no
 * upload, clear Norwegian message in the UI).
 */

export type Sensitivity = Document['sensitivity'];

/** Sensitivity class → bucket. The four buckets from doc 04. */
const BUCKET_BY_SENSITIVITY: Record<Sensitivity, string> = {
  public: 'docs-public',
  internal: 'docs-internal',
  confidential: 'docs-confidential',
  restricted: 'docs-restricted',
};

export function bucketForSensitivity(sensitivity: Sensitivity): string {
  return BUCKET_BY_SENSITIVITY[sensitivity];
}

/**
 * Tenant-prefixed, hierarchical storage path (doc 04 § Path convention):
 *   org_<org>/<entity_type>/<entity_id>/<document_id>/<filename>
 */
export function buildStoragePath(input: {
  organizationId: string;
  linkedEntityType: string;
  linkedEntityId: string;
  documentId: string;
  filename: string;
}): string {
  const safeName = input.filename.replace(/[^\w.\-]+/g, '_');
  return [
    `org_${input.organizationId}`,
    input.linkedEntityType,
    input.linkedEntityId,
    input.documentId,
    safeName,
  ].join('/');
}

/** A new document id (used to build the path before the row is inserted). */
export function newDocumentId(): string {
  return randomUUID();
}

/**
 * Whether Supabase Storage is configured. Requires the service-role key in
 * addition to the project URL (uploads/signed URLs are a server-side concern).
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
