import { and, desc, eq, gte } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { auditEvents } from '@/db/schemas/audit/audit-events';
import type { AuditEvent } from '@/db/types';

/**
 * Platform audit search (Dev surface). Cross-org reads via the service-role
 * connection (audit_events is RLS-protected from tenant connections). In
 * production this is gated by `platform:audit:view` and every search is itself
 * recorded to platform_audit_events.
 */
export interface AuditSearchFilter {
  organizationId?: string;
  entityTable?: string;
  entityId?: string;
  action?: string;
  since?: Date;
  limit?: number;
}

export async function searchAuditEvents(
  filter: AuditSearchFilter,
): Promise<AuditEvent[]> {
  const db = getRawClient({ as: 'platform-inspector' });

  const conditions = [];
  if (filter.organizationId) {
    conditions.push(eq(auditEvents.organizationId, filter.organizationId));
  }
  if (filter.entityTable) {
    conditions.push(eq(auditEvents.entityTable, filter.entityTable));
  }
  if (filter.entityId) {
    conditions.push(eq(auditEvents.entityId, filter.entityId));
  }
  if (filter.action) {
    conditions.push(eq(auditEvents.action, filter.action));
  }
  if (filter.since) {
    conditions.push(gte(auditEvents.occurredAt, filter.since));
  }

  return db
    .select()
    .from(auditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(filter.limit ?? 100);
}

/** The audit trail for a single entity (Dev inspect detail). */
export async function auditTrailFor(
  entityTable: string,
  entityId: string,
): Promise<AuditEvent[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.entityTable, entityTable),
        eq(auditEvents.entityId, entityId),
      ),
    )
    .orderBy(desc(auditEvents.occurredAt))
    .limit(200);
}
