import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { documentAccessEvents } from '@/db/schemas/documents/document-access-events';
import { documentLinks } from '@/db/schemas/documents/document-links';
import { documents } from '@/db/schemas/documents/documents';
import type { Document, DocumentLink } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  bucketForSensitivity,
  buildStoragePath,
  newDocumentId,
  type Sensitivity,
} from '../../infrastructure/storage/storage-port';

/**
 * Documents service (docs/04-document-architecture.md). Registers a document's
 * metadata + its first link in one transaction. The physical bytes are uploaded
 * to Supabase Storage separately (server builds the path + bucket here); this
 * keeps the metadata row authoritative and the storage layout deterministic.
 *
 * Permission: `case:edit` (documents attach to operational entities; a finer
 * documents permission is unnecessary at this stage — YAGNI).
 */

export interface RegisterDocumentInput {
  kind: Document['kind'];
  sensitivity?: Sensitivity;
  source?: Document['source'];
  originalFilename: string;
  contentType?: string;
  byteSize?: number;
  checksumSha256?: string;
  /** What this document attaches to (creates the first link). */
  linkedEntityType: DocumentLink['linkedEntityType'];
  linkedEntityId: string;
  linkRole?: DocumentLink['role'];
  metadata?: Record<string, unknown>;
}

export interface RegisteredDocument {
  document: Document;
  link: DocumentLink;
  /** Where the client should upload the bytes (bucket + path). */
  storage: { bucket: string; path: string };
}

export async function registerDocument(
  ctx: RequestContext,
  input: RegisterDocumentInput,
): Promise<RegisteredDocument> {
  await requirePermission(ctx, 'case:edit');

  const sensitivity: Sensitivity = input.sensitivity ?? 'internal';
  const bucket = bucketForSensitivity(sensitivity);
  const documentId = newDocumentId();
  const path = buildStoragePath({
    organizationId: ctx.organizationId,
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
    documentId,
    filename: input.originalFilename,
  });

  return withTransaction(ctx, async (tx) => {
    const insertedDoc = await tx
      .insert(documents)
      .values({
        id: documentId,
        organizationId: ctx.organizationId,
        kind: input.kind,
        source: input.source ?? 'upload',
        sensitivity,
        storageBucket: bucket,
        storagePath: path,
        originalFilename: input.originalFilename,
        contentType: input.contentType ?? null,
        byteSize: input.byteSize ?? null,
        checksumSha256: input.checksumSha256 ?? null,
        uploadedByUserId: ctx.userId,
        uploadedByKind: 'user',
        metadata: (input.metadata ?? null) as never,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const document = insertedDoc[0];
    if (!document) throw new Error('Failed to register document');

    const insertedLink = await tx
      .insert(documentLinks)
      .values({
        organizationId: ctx.organizationId,
        documentId: document.id,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
        role: input.linkRole ?? 'attachment',
        linkedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const link = insertedLink[0];
    if (!link) throw new Error('Failed to link document');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'documents',
      entityId: document.id,
      after: {
        kind: input.kind,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'documents.document.registered',
      payload: {
        documentId: document.id,
        kind: input.kind,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
      },
    });

    return { document, link, storage: { bucket, path } };
  });
}

/** Mark a document processed (image pipeline / virus scan complete). */
export async function markDocumentProcessed(
  ctx: RequestContext,
  documentId: string,
  variants?: Record<string, string>,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(documents)
      .set({
        isProcessed: true,
        variants: (variants ?? null) as never,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, ctx.organizationId),
        ),
      );
  });
}

/** Record a sensitive-file access (append-only). */
export async function recordDocumentAccess(
  ctx: RequestContext,
  documentId: string,
  action: 'viewed' | 'downloaded' | 'signed_url_issued',
  detail?: string,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx.insert(documentAccessEvents).values({
      organizationId: ctx.organizationId,
      documentId,
      action,
      actorUserId: ctx.userId,
      detail: detail ?? null,
    });
  });
}

/** List documents linked to an entity, with a specific role filter. */
export async function listDocumentsForEntity(
  ctx: RequestContext,
  linkedEntityType: DocumentLink['linkedEntityType'],
  linkedEntityId: string,
): Promise<Array<{ document: Document; role: DocumentLink['role'] }>> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ document: documents, role: documentLinks.role })
      .from(documentLinks)
      .innerJoin(documents, eq(documents.id, documentLinks.documentId))
      .where(
        and(
          eq(documentLinks.organizationId, ctx.organizationId),
          eq(documentLinks.linkedEntityType, linkedEntityType),
          eq(documentLinks.linkedEntityId, linkedEntityId),
          isNull(documentLinks.deletedAt),
          isNull(documents.deletedAt),
        ),
      )
      .orderBy(desc(documents.uploadedAt));
    return rows.map((r) => ({ document: r.document, role: r.role }));
  });
}
