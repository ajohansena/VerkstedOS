import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  documentKind,
  documentSensitivity,
  documentSource,
  documentUploaderKind,
} from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Document — the cross-cutting metadata row (docs/04-document-architecture.md).
 * Physical bytes live in Supabase Storage, organized by SENSITIVITY-class
 * bucket; this row holds the metadata, variants, versioning, and processing
 * state. A single conceptual document may have multiple physical files
 * (original + sized variants), described by the `variants` JSONB.
 *
 * Versioning: immutable kinds (estimate/invoice/credit) create a NEW row that
 * supersedes the prior via `supersedes_id`; `is_current_version` flags the head.
 * `is_processed` is false until the image pipeline / virus scan completes.
 */
export const documents = pgTable(
  'documents',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    kind: documentKind('kind').notNull(),
    source: documentSource('source').notNull().default('upload'),
    sensitivity: documentSensitivity('sensitivity')
      .notNull()
      .default('internal'),

    storageBucket: varchar('storage_bucket', { length: 64 }).notNull(),
    storagePath: text('storage_path').notNull(),
    originalFilename: text('original_filename'),
    contentType: varchar('content_type', { length: 128 }),
    byteSize: integer('byte_size'),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    /** Rendered variants, e.g. {"1920": path, "480": path, "thumb": path}. */
    variants: jsonb('variants'),

    versionNumber: integer('version_number').notNull().default(1),
    supersedesId: uuid('supersedes_id'),
    isCurrentVersion: boolean('is_current_version').notNull().default(true),

    uploadedByUserId: uuid('uploaded_by_user_id'),
    uploadedByKind: documentUploaderKind('uploaded_by_kind')
      .notNull()
      .default('user'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    isSigned: boolean('is_signed').notNull().default(false),
    signatureChainId: uuid('signature_chain_id'),

    /** False until the image pipeline / virus scan finishes. */
    isProcessed: boolean('is_processed').notNull().default(false),

    retentionUntil: timestamp('retention_until', { withTimezone: true }),

    /** Kind-specific: EXIF, OCR text, parsed structured data. */
    metadata: jsonb('metadata'),

    deletedReason: text('deleted_reason'),
    ...lifecycleColumns,
  },
  (table) => [
    index('documents_org_kind_idx').on(
      table.organizationId,
      table.kind,
      table.isCurrentVersion,
    ),
  ],
);
