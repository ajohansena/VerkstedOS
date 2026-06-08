/**
 * Documents — public surface (docs/04-document-architecture.md).
 *
 * The cross-cutting documents module: metadata, polymorphic links, and the
 * sensitive-file access log. Physical bytes live in Supabase Storage by
 * sensitivity class. The ONLY entry point other modules and the app may import.
 */

export type { Document, DocumentLink, DocumentAccessEvent } from '@/db/types';

export {
  registerDocument,
  markDocumentProcessed,
  recordDocumentAccess,
  listDocumentsForEntity,
  type RegisterDocumentInput,
  type RegisteredDocument,
} from '../application/services/documents';

export {
  isStorageConfigured,
  bucketForSensitivity,
  type Sensitivity,
} from '../infrastructure/storage/storage-port';
