import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { documents } from '@/db/schemas/documents/documents';

/**
 * Document inspection (Dev surface, /dev/documents). Cross-org → service-role
 * connection. Lists document metadata for support and the virus-scan / image
 * pipeline backlog (is_processed = false).
 */

export interface DocumentRow {
  readonly id: string;
  readonly kind: string;
  readonly sensitivity: string;
  readonly storageBucket: string;
  readonly originalFilename: string | null;
  readonly isProcessed: boolean;
  readonly uploadedAt: Date;
}

export async function listDocumentsForOrg(
  organizationId: string,
  limit = 100,
): Promise<DocumentRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: documents.id,
      kind: documents.kind,
      sensitivity: documents.sensitivity,
      storageBucket: documents.storageBucket,
      originalFilename: documents.originalFilename,
      isProcessed: documents.isProcessed,
      uploadedAt: documents.uploadedAt,
    })
    .from(documents)
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.uploadedAt))
    .limit(limit);
}
