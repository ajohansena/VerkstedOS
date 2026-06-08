import { and, desc, eq } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { caseAcceptances } from '@/db/schemas/communication/case-acceptances';
import { cases } from '@/db/schemas/case/cases';
import type { CaseAcceptance } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { ensureThread, newToken, sendMessage } from './messaging';

/**
 * Customer acceptance — the customer's approval to START a repair
 * (docs/03-data-model.md, full audit). The customer must approve EVERY repair
 * start, and staff must SEE the status at a glance.
 *
 * Request flow: staff request acceptance → an SMS (preferred) or email (backup)
 * goes to the customer with a link to their job card (`/jobbkort/<token>`).
 * The customer accepts by (a) opening the link and pressing accept, or (b)
 * replying OK to the SMS. Both update the same acceptance record; the
 * conversation is stored in the linked thread, fully traceable.
 */

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ACCEPTANCE_KEYWORDS = ['ok', 'ja', 'godkjent', 'godkjenner', 'yes', 'j'];

function systemContext(organizationId: string): RequestContext {
  return {
    userId: SYSTEM_USER_ID,
    organizationId,
    workshopId: null,
    accessibleWorkshopIds: [],
    correlationId: newToken().slice(0, 32),
  };
}

export interface RequestAcceptanceInput {
  caseId: string;
  channel: 'sms' | 'email';
  contactValue: string;
  customerId?: string | null;
  summary?: string;
  /** Base URL for the public job-card link (e.g. https://app.example.no). */
  siteUrl: string;
}

export interface RequestAcceptanceResult {
  acceptance: CaseAcceptance;
  jobCardUrl: string;
  /** True when the message was actually sent; false = queued (no provider). */
  delivered: boolean;
}

/** Create a pending acceptance and send the job-card link to the customer. */
export async function requestAcceptance(
  ctx: RequestContext,
  input: RequestAcceptanceInput,
): Promise<RequestAcceptanceResult> {
  await requirePermission(ctx, 'case:edit');

  const token = newToken();
  const jobCardUrl = `${input.siteUrl.replace(/\/$/, '')}/jobbkort/${token}`;

  const thread = await ensureThread(ctx, {
    caseId: input.caseId,
    channel: input.channel,
    contactValue: input.contactValue,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    subject: 'Godkjenning av reparasjon',
  });

  const acceptance = await withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(caseAcceptances)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        customerId: input.customerId ?? null,
        threadId: thread.id,
        channel: input.channel,
        status: 'pending',
        token,
        summary: input.summary ?? null,
        requestedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error('Failed to create acceptance');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_acceptances',
      entityId: row.id,
      after: { caseId: input.caseId, channel: input.channel },
    });

    await emitEvent(tx, ctx, {
      eventType: 'communication.acceptance.requested',
      payload: { caseId: input.caseId, acceptanceId: row.id },
    });

    return row;
  });

  // Send the message (queued if no provider). Norwegian body with the link.
  const body =
    `Hei! Vennligst godkjenn reparasjonen av kjøretøyet ditt. ` +
    `Se detaljer og godkjenn her: ${jobCardUrl} ` +
    `Du kan også svare OK på denne meldingen.`;
  const message = await sendMessage(ctx, {
    threadId: thread.id,
    channel: input.channel,
    contactValue: input.contactValue,
    body,
    subject: 'Godkjenning av reparasjon',
  });

  return {
    acceptance,
    jobCardUrl,
    delivered: message.status === 'sent',
  };
}

export interface PublicJobCard {
  acceptanceId: string;
  status: CaseAcceptance['status'];
  caseNumber: string;
  summary: string | null;
}

/** PUBLIC read for the job-card page (resolves org from the token, no auth). */
export async function getAcceptanceByToken(
  token: string,
): Promise<PublicJobCard | null> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .select({
      acceptanceId: caseAcceptances.id,
      status: caseAcceptances.status,
      summary: caseAcceptances.summary,
      caseNumber: cases.caseNumber,
    })
    .from(caseAcceptances)
    .innerJoin(cases, eq(cases.id, caseAcceptances.caseId))
    .where(eq(caseAcceptances.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    acceptanceId: row.acceptanceId,
    status: row.status,
    caseNumber: row.caseNumber,
    summary: row.summary,
  };
}

/**
 * PUBLIC: the customer accepts/declines from the job-card page. Resolves the
 * org from the token, then records the decision under that org's RLS. Only acts
 * on a `pending` acceptance (idempotent for repeat clicks).
 */
export async function respondViaJobCard(
  token: string,
  decision: 'accepted' | 'declined',
): Promise<CaseAcceptance | null> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .select()
    .from(caseAcceptances)
    .where(eq(caseAcceptances.token, token))
    .limit(1);
  const acceptance = rows[0];
  if (!acceptance) return null;
  if (acceptance.status !== 'pending') return acceptance;

  return applyDecision(acceptance.organizationId, acceptance.id, {
    decision,
    method: 'job_card_link',
    responseText: null,
  });
}

/**
 * Inbound reply handler (called by the SMS webhook after the message is
 * stored). If the body is an acceptance keyword (OK/JA…), the pending
 * acceptance on that thread is accepted (`sms_reply`). Org is already known.
 */
export async function handleInboundReply(input: {
  organizationId: string;
  threadId: string;
  body: string;
}): Promise<CaseAcceptance | null> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .select()
    .from(caseAcceptances)
    .where(
      and(
        eq(caseAcceptances.organizationId, input.organizationId),
        eq(caseAcceptances.threadId, input.threadId),
        eq(caseAcceptances.status, 'pending'),
      ),
    )
    .orderBy(desc(caseAcceptances.requestedAt))
    .limit(1);
  const acceptance = rows[0];
  if (!acceptance) return null;

  const normalized = input.body.trim().toLowerCase();
  const isAccept = ACCEPTANCE_KEYWORDS.some(
    (kw) => normalized === kw || normalized.startsWith(`${kw} `),
  );
  if (!isAccept) return null;

  return applyDecision(input.organizationId, acceptance.id, {
    decision: 'accepted',
    method: 'sms_reply',
    responseText: input.body,
  });
}

async function applyDecision(
  organizationId: string,
  acceptanceId: string,
  input: {
    decision: 'accepted' | 'declined';
    method: CaseAcceptance['method'];
    responseText: string | null;
  },
): Promise<CaseAcceptance> {
  const ctx = systemContext(organizationId);
  return withTransaction(ctx, async (tx) => {
    const updated = await tx
      .update(caseAcceptances)
      .set({
        status: input.decision,
        method: input.method,
        respondedAt: new Date(),
        responseText: input.responseText,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(caseAcceptances.id, acceptanceId),
          eq(caseAcceptances.organizationId, organizationId),
        ),
      )
      .returning();
    const row = updated[0];
    if (!row) throw new Error('Acceptance not found');

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'case_acceptances',
      entityId: acceptanceId,
      reason: `Customer ${input.decision} via ${input.method}`,
      after: { status: input.decision, method: input.method },
    });

    await emitEvent(tx, ctx, {
      eventType:
        input.decision === 'accepted'
          ? 'communication.acceptance.accepted'
          : 'communication.acceptance.declined',
      payload: { caseId: row.caseId, acceptanceId, method: input.method },
    });

    return row;
  });
}

/** Staff records a verbal/in-person acceptance (`manual`). */
export async function recordManualAcceptance(
  ctx: RequestContext,
  caseId: string,
  note: string,
): Promise<CaseAcceptance> {
  await requirePermission(ctx, 'case:edit');
  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(caseAcceptances)
      .values({
        organizationId: ctx.organizationId,
        caseId,
        status: 'accepted',
        token: newToken(),
        method: 'manual',
        respondedAt: new Date(),
        responseText: note,
        requestedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error('Failed to record acceptance');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_acceptances',
      entityId: row.id,
      reason: 'Manual acceptance recorded',
      after: { caseId, method: 'manual' },
    });

    return row;
  });
}

export async function listAcceptances(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseAcceptance[]> {
  await requirePermission(ctx, 'case:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(caseAcceptances)
      .where(
        and(
          eq(caseAcceptances.organizationId, ctx.organizationId),
          eq(caseAcceptances.caseId, caseId),
        ),
      )
      .orderBy(desc(caseAcceptances.requestedAt));
  });
}

/** The current acceptance state for a case (newest), for the case header. */
export async function latestAcceptance(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseAcceptance | null> {
  const list = await listAcceptances(ctx, caseId);
  return list[0] ?? null;
}
