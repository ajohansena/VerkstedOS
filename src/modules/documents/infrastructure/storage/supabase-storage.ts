import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  bucketForSensitivity,
  isStorageConfigured,
  type Sensitivity,
} from './storage-port';

/**
 * Supabase Storage adapter (docs/04-document-architecture.md). Server-only:
 * uses the service-role key to mint short-lived signed URLs for direct
 * browser↔Storage transfer (the bytes never pass through the app server) and to
 * provision the sensitivity-class buckets.
 *
 * This is the implementation behind the storage port; callers go through the
 * documents service / server actions, never here directly. Gated on
 * `isStorageConfigured()` — when storage is absent the documents flow degrades
 * to metadata-only (no upload) with a clear Norwegian notice in the UI.
 */

let cached: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new Error(
      'Supabase Storage is not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return cached;
}

/** Signed URL the browser uses to upload bytes directly to Storage. */
export interface SignedUpload {
  readonly bucket: string;
  readonly path: string;
  readonly token: string;
  readonly signedUrl: string;
}

export async function createSignedUpload(
  bucket: string,
  path: string,
): Promise<SignedUpload> {
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }
  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Short-lived signed URL to view/download a stored object. When `width` is
 * given, requests Supabase's on-the-fly image transform (a thumbnail); projects
 * without the transform add-on transparently serve the original.
 */
export async function createSignedDownload(
  bucket: string,
  path: string,
  options?: { expiresInSeconds?: number; width?: number },
): Promise<string | null> {
  const expiresIn = options?.expiresInSeconds ?? 300;
  const transform = options?.width
    ? { transform: { width: options.width, resize: 'contain' as const } }
    : undefined;
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn, transform);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Provision the four sensitivity-class buckets (idempotent). */
export async function ensureBuckets(): Promise<string[]> {
  const sensitivities: Sensitivity[] = [
    'public',
    'internal',
    'confidential',
    'restricted',
  ];
  const created: string[] = [];
  for (const sensitivity of sensitivities) {
    const bucket = bucketForSensitivity(sensitivity);
    const isPublic = sensitivity === 'public';
    const { error } = await client().storage.createBucket(bucket, {
      public: isPublic,
    });
    if (!error) {
      created.push(bucket);
    } else if (!/already exists/i.test(error.message)) {
      throw new Error(`Failed to create bucket ${bucket}: ${error.message}`);
    }
  }
  return created;
}
