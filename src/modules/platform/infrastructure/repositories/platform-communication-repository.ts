import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { caseAcceptances } from '@/db/schemas/communication/case-acceptances';
import { communicationMessages } from '@/db/schemas/communication/communication-messages';

/**
 * Communication inspection (Dev surface, /dev/communication). Cross-org →
 * service-role connection. Recent acceptances (with status + method) and the
 * outbound message backlog (status = 'queued' when no SMS/email provider is
 * configured yet) for support + delivery troubleshooting.
 */

export interface AcceptanceRow {
  readonly id: string;
  readonly caseId: string;
  readonly status: string;
  readonly method: string | null;
  readonly channel: string | null;
  readonly requestedAt: Date;
}

export async function listAcceptancesForOrg(
  organizationId: string,
  limit = 100,
): Promise<AcceptanceRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: caseAcceptances.id,
      caseId: caseAcceptances.caseId,
      status: caseAcceptances.status,
      method: caseAcceptances.method,
      channel: caseAcceptances.channel,
      requestedAt: caseAcceptances.requestedAt,
    })
    .from(caseAcceptances)
    .where(eq(caseAcceptances.organizationId, organizationId))
    .orderBy(desc(caseAcceptances.requestedAt))
    .limit(limit);
}

export interface QueuedMessageRow {
  readonly id: string;
  readonly threadId: string;
  readonly channel: string;
  readonly direction: string;
  readonly status: string;
  readonly occurredAt: Date;
}

/** Outbound messages still queued (no provider) — the delivery backlog. */
export async function listQueuedMessagesForOrg(
  organizationId: string,
  limit = 100,
): Promise<QueuedMessageRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: communicationMessages.id,
      threadId: communicationMessages.threadId,
      channel: communicationMessages.channel,
      direction: communicationMessages.direction,
      status: communicationMessages.status,
      occurredAt: communicationMessages.occurredAt,
    })
    .from(communicationMessages)
    .where(eq(communicationMessages.organizationId, organizationId))
    .orderBy(desc(communicationMessages.occurredAt))
    .limit(limit);
}
