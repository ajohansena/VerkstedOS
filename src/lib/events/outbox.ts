import { outboxEvents } from '@/db/schemas/audit/outbox-events';
import type { TenantTransaction } from '@/db/client';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Outbox emitter (docs/02-system-architecture.md § Outbox pattern).
 *
 * Insert a domain event into `outbox_events` in the SAME transaction as the
 * mutation. A separate Inngest cron ships pending rows and marks them published,
 * so events are emitted only if the originating transaction commits. Consumers
 * dedupe on `event_id`.
 *
 * Event names follow `<context>.<aggregate>.<past_tense_verb>`.
 */
export interface EmitInput {
  eventType: string;
  payload: Record<string, unknown>;
  eventVersion?: number;
  workshopId?: string | null;
  causationId?: string | null;
}

export async function emitEvent(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: EmitInput,
): Promise<void> {
  await tx.insert(outboxEvents).values({
    eventType: input.eventType,
    eventVersion: input.eventVersion ?? 1,
    organizationId: ctx.organizationId,
    workshopId: input.workshopId ?? ctx.workshopId ?? null,
    actorKind: 'user',
    actorId: ctx.userId,
    correlationId: ctx.correlationId,
    causationId: input.causationId ?? null,
    payload: input.payload as never,
    status: 'pending',
  });
}
