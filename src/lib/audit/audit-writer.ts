import { auditEvents } from '@/db/schemas/audit/audit-events';
import type { TenantTransaction } from '@/db/client';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Audit writer (docs/03-data-model.md § Write enforcement).
 *
 * The full-audit primitive: insert an immutable `audit_events` row in the SAME
 * transaction as the mutation. `audit_events` is append-only (RLS allows only
 * INSERT/SELECT), so corrections are new rows, never updates.
 *
 * Actions that change state irreversibly require a `reason` — enforced at the
 * TypeScript boundary via the discriminated `AuditWrite` type below.
 */

/** Actions that always require a reason (transitions / deletions). */
export type ReasonRequiredAction =
  | 'deleted'
  | 'transitioned'
  | 'transferred'
  | 'cancelled';

/** Actions where a reason is optional. */
export type ReasonOptionalAction = 'created' | 'updated' | 'restored';

export type AuditWrite =
  | {
      action: ReasonRequiredAction;
      entityTable: string;
      entityId: string;
      reason: string; // mandatory
      before?: unknown;
      after?: unknown;
      metadata?: Record<string, unknown>;
      workshopId?: string | null;
    }
  | {
      action: ReasonOptionalAction;
      entityTable: string;
      entityId: string;
      reason?: string;
      before?: unknown;
      after?: unknown;
      metadata?: Record<string, unknown>;
      workshopId?: string | null;
    };

/**
 * Record a full-tier audit event inside an existing tenant transaction. Must be
 * called within `withTransaction` so it shares the mutation's atomicity and the
 * org RLS context.
 */
export async function recordAuditEvent(
  tx: TenantTransaction,
  ctx: RequestContext,
  write: AuditWrite,
): Promise<void> {
  await tx.insert(auditEvents).values({
    organizationId: ctx.organizationId,
    workshopId: write.workshopId ?? ctx.workshopId ?? null,
    actorUserId: ctx.userId,
    actorKind: 'user',
    entityTable: write.entityTable,
    entityId: write.entityId,
    action: write.action,
    before: (write.before ?? null) as never,
    after: (write.after ?? null) as never,
    reason: write.reason ?? null,
    metadata: (write.metadata ?? null) as never,
    correlationId: ctx.correlationId,
  });
}
