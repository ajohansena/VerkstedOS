import { randomBytes } from 'node:crypto';

import { and, asc, desc, eq } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { emitEvent } from '@/lib/events/outbox';
import { communicationMessages } from '@/db/schemas/communication/communication-messages';
import { communicationThreads } from '@/db/schemas/communication/communication-threads';
import type { CommunicationMessage, CommunicationThread } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { sendSms } from '../../infrastructure/adapters/sms-adapter';
import { sendEmail } from '../../infrastructure/adapters/email-adapter';

/**
 * Messaging — SMS/email threads with customers (docs/03-data-model.md). Both
 * directions are stored so the chat is traceable. Outbound messages are sent
 * via the gated adapters; when no provider is configured the message is stored
 * `queued` (not lost). `case:edit` is required to send.
 */

export interface EnsureThreadInput {
  caseId: string;
  channel: CommunicationThread['channel'];
  contactValue: string;
  customerId?: string | null;
  subject?: string;
}

/** Find an open thread for (case, channel, contact) or create one. */
export async function ensureThread(
  ctx: RequestContext,
  input: EnsureThreadInput,
): Promise<CommunicationThread> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(communicationThreads)
      .where(
        and(
          eq(communicationThreads.organizationId, ctx.organizationId),
          eq(communicationThreads.caseId, input.caseId),
          eq(communicationThreads.channel, input.channel),
          eq(communicationThreads.contactValue, input.contactValue),
          eq(communicationThreads.status, 'open'),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];

    const inserted = await tx
      .insert(communicationThreads)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        customerId: input.customerId ?? null,
        channel: input.channel,
        contactValue: input.contactValue,
        subject: input.subject ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const thread = inserted[0];
    if (!thread) throw new Error('Failed to create thread');
    return thread;
  });
}

export interface SendMessageInput {
  threadId: string;
  channel: CommunicationThread['channel'];
  contactValue: string;
  body: string;
  subject?: string;
}

/**
 * Send an outbound message and store it. Returns the stored message; its
 * `status` is `sent` when a provider accepted it, otherwise `queued` (no
 * provider configured yet — the message waits, fully traceable).
 */
export async function sendMessage(
  ctx: RequestContext,
  input: SendMessageInput,
): Promise<CommunicationMessage> {
  await requirePermission(ctx, 'case:edit');

  const result =
    input.channel === 'sms'
      ? await sendSms(input.contactValue, input.body)
      : await sendEmail(
          input.contactValue,
          input.subject ?? 'VerkstedOS',
          input.body,
        );

  const status = result.status === 'sent' ? 'sent' : 'queued';
  const providerMessageId =
    result.status === 'sent' ? result.providerMessageId : null;

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(communicationMessages)
      .values({
        organizationId: ctx.organizationId,
        threadId: input.threadId,
        direction: 'outbound',
        channel: input.channel,
        body: input.body,
        status,
        providerMessageId,
        sentByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const message = inserted[0];
    if (!message) throw new Error('Failed to store message');

    await tx
      .update(communicationThreads)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(communicationThreads.id, input.threadId));

    await emitEvent(tx, ctx, {
      eventType: 'communication.message.sent',
      payload: {
        threadId: input.threadId,
        channel: input.channel,
        status,
      },
    });

    return message;
  });
}

export async function listThreads(
  ctx: RequestContext,
  caseId: string,
): Promise<CommunicationThread[]> {
  await requirePermission(ctx, 'case:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(communicationThreads)
      .where(
        and(
          eq(communicationThreads.organizationId, ctx.organizationId),
          eq(communicationThreads.caseId, caseId),
        ),
      )
      .orderBy(desc(communicationThreads.lastMessageAt));
  });
}

export async function listMessages(
  ctx: RequestContext,
  threadId: string,
): Promise<CommunicationMessage[]> {
  await requirePermission(ctx, 'case:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(communicationMessages)
      .where(
        and(
          eq(communicationMessages.organizationId, ctx.organizationId),
          eq(communicationMessages.threadId, threadId),
        ),
      )
      .orderBy(asc(communicationMessages.occurredAt));
  });
}

/** A fresh opaque token for a public job-card / acceptance link. */
export function newToken(): string {
  return randomBytes(24).toString('hex');
}

export interface ResolvedThread {
  organizationId: string;
  threadId: string;
  channel: CommunicationThread['channel'];
}

/**
 * Resolve the most recent OPEN thread for an inbound contact (phone/email),
 * across orgs (the webhook has no session). Used by the inbound route to attach
 * a reply to the right conversation. The org is then known for all writes.
 */
export async function resolveOpenThreadByContact(
  channel: CommunicationThread['channel'],
  contactValue: string,
): Promise<ResolvedThread | null> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .select({
      organizationId: communicationThreads.organizationId,
      threadId: communicationThreads.id,
      channel: communicationThreads.channel,
    })
    .from(communicationThreads)
    .where(
      and(
        eq(communicationThreads.channel, channel),
        eq(communicationThreads.contactValue, contactValue),
        eq(communicationThreads.status, 'open'),
      ),
    )
    .orderBy(desc(communicationThreads.lastMessageAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Store an INBOUND message (from the SMS/email webhook). Runs without a user
 * session — the org is resolved from the thread. Used by the inbound route and
 * the acceptance reply handler. Internal (not permission-checked); callers are
 * trusted server routes that have already validated the provider signature.
 */
export async function storeInboundMessage(input: {
  organizationId: string;
  threadId: string;
  channel: CommunicationThread['channel'];
  body: string;
  providerMessageId?: string | null;
}): Promise<CommunicationMessage> {
  const db = getRawClient({ as: 'integration' });
  const inserted = await db
    .insert(communicationMessages)
    .values({
      organizationId: input.organizationId,
      threadId: input.threadId,
      direction: 'inbound',
      channel: input.channel,
      body: input.body,
      status: 'received',
      providerMessageId: input.providerMessageId ?? null,
    })
    .returning();
  const message = inserted[0];
  if (!message) throw new Error('Failed to store inbound message');

  await db
    .update(communicationThreads)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(communicationThreads.id, input.threadId));

  return message;
}
