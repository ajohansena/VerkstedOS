import { getRawClient } from '@/db/client';
import { platformAuditEvents } from '@/db/schemas/platform/platform-audit-events';

import type { PlatformContext } from './auth';

/**
 * Platform audit logger (docs/06-developer-control-plane.md § Platform audit).
 *
 * Records every platform action AND every read of sensitive customer data
 * (`action = 'viewed'`) to the dedicated `platform_audit_events` log. Written on
 * the service-role connection. `reason` is required for any state-changing
 * action (enforced by the typed `reason` field on those call sites).
 */
export type PlatformAuditAction =
  | 'viewed'
  | 'impersonated_started'
  | 'impersonated_ended'
  | 'event_replayed'
  | 'job_retried'
  | 'projection_rebuilt'
  | 'data_repaired'
  | 'org_locked'
  | 'org_unlocked'
  | 'feature_flag_changed'
  | 'integration_disabled'
  | 'dangerous_op_requested'
  | 'dangerous_op_approved'
  | 'dangerous_op_rejected'
  | 'dangerous_op_executed'
  | 'dangerous_op_cancelled';

export interface PlatformAuditInput {
  action: PlatformAuditAction;
  targetOrgId?: string | null;
  targetUserId?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordPlatformAudit(
  ctx: PlatformContext,
  input: PlatformAuditInput,
): Promise<void> {
  const db = getRawClient({ as: 'platform-inspector' });
  await db.insert(platformAuditEvents).values({
    platformUserId: ctx.platformUserId,
    platformRoleAtAction: ctx.roles[0] ?? null,
    targetOrgId: input.targetOrgId ?? null,
    targetUserId: input.targetUserId ?? null,
    targetEntityType: input.targetEntityType ?? null,
    targetEntityId: input.targetEntityId ?? null,
    action: input.action,
    before: (input.before ?? null) as never,
    after: (input.after ?? null) as never,
    reason: input.reason ?? null,
    metadata: (input.metadata ?? null) as never,
  });
}
