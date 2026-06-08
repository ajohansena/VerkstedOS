import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { integrationInbox } from '@/db/schemas/estimating/integration-inbox';

/**
 * DBS integration inspection (Dev surface, /dev/integrations/dbs). Cross-org →
 * service-role connection. Shows the inbox landing zone: received / processed /
 * failed payloads with parse errors, for monitoring and replay.
 */

export interface InboxItem {
  readonly id: string;
  readonly organizationId: string | null;
  readonly source: string;
  readonly messageType: string | null;
  readonly externalRef: string | null;
  readonly status: string;
  readonly parseError: string | null;
  readonly producedImportId: string | null;
  readonly receivedAt: Date;
}

export async function listDbsInbox(limit = 50): Promise<InboxItem[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: integrationInbox.id,
      organizationId: integrationInbox.organizationId,
      source: integrationInbox.source,
      messageType: integrationInbox.messageType,
      externalRef: integrationInbox.externalRef,
      status: integrationInbox.status,
      parseError: integrationInbox.parseError,
      producedImportId: integrationInbox.producedImportId,
      receivedAt: integrationInbox.receivedAt,
    })
    .from(integrationInbox)
    .where(eq(integrationInbox.source, 'dbs'))
    .orderBy(desc(integrationInbox.receivedAt))
    .limit(limit);
}

export async function dbsInboxStats(): Promise<{
  received: number;
  processed: number;
  failed: number;
}> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .select({ status: integrationInbox.status })
    .from(integrationInbox)
    .where(eq(integrationInbox.source, 'dbs'));
  let received = 0;
  let processed = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === 'received' || r.status === 'processing') received += 1;
    if (r.status === 'processed') processed += 1;
    if (r.status === 'failed') failed += 1;
  }
  return { received, processed, failed };
}
