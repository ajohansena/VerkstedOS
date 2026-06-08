import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Communication & customer acceptance integration suite (Sprint 12).
 *
 * Validates the binding requirement against real Postgres: the customer must
 * approve EVERY repair start, staff see the status at a glance, and the SMS/
 * email conversation is stored and traceable. Covers both acceptance routes —
 * the job-card link AND an "OK" SMS reply — plus the queued-when-no-provider
 * behaviour and a manual (in-person) acceptance.
 */
describe('communication & acceptance', () => {
  let h: IsolationHarness;
  let comms: typeof import('@/modules/communication/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    comms = await import('@/modules/communication/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b4';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner12c@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Kommunikasjon Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseId = created.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId: null,
      accessibleWorkshopIds: [] as string[],
      correlationId: '00000000-0000-0000-0000-0000000000f6',
    };
  }

  it('requests acceptance: pending record + thread + queued SMS', async () => {
    const result = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4799887766',
      summary: 'Bytte frontlykt og støtfanger',
      siteUrl: 'https://app.example.no',
    });
    expect(result.acceptance.status).toBe('pending');
    expect(result.jobCardUrl).toContain('/jobbkort/');
    // No SMS provider configured in tests → message is queued, not lost.
    expect(result.delivered).toBe(false);

    // Staff sees the status at a glance.
    const latest = await comms.latestAcceptance(ctx(), caseId);
    expect(latest!.status).toBe('pending');

    // The outbound message is stored (traceable).
    const threads = await comms.listThreads(ctx(), caseId);
    expect(threads.length).toBe(1);
    const messages = await comms.listMessages(ctx(), threads[0]!.id);
    expect(messages.length).toBe(1);
    expect(messages[0]!.direction).toBe('outbound');
    expect(messages[0]!.status).toBe('queued');
  });

  it('customer accepts via the job-card link', async () => {
    const result = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4791111111',
      siteUrl: 'https://app.example.no',
    });
    const token = result.jobCardUrl.split('/jobbkort/')[1]!;

    // Public read (no auth) resolves the job card from the token.
    const card = await comms.getAcceptanceByToken(token);
    expect(card!.status).toBe('pending');
    expect(card!.caseNumber).toBeTruthy();

    const accepted = await comms.respondViaJobCard(token, 'accepted');
    expect(accepted!.status).toBe('accepted');
    expect(accepted!.method).toBe('job_card_link');

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'communication.acceptance.accepted'
    `;
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('customer accepts by replying OK to the SMS (stored + traceable)', async () => {
    const result = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4792222222',
      siteUrl: 'https://app.example.no',
    });

    // Inbound webhook resolves the open thread by the sender's number.
    const resolved = await comms.resolveOpenThreadByContact(
      'sms',
      '+4792222222',
    );
    expect(resolved).not.toBeNull();

    // The reply is stored (the chat is traceable), then interpreted.
    await comms.storeInboundMessage({
      organizationId: resolved!.organizationId,
      threadId: resolved!.threadId,
      channel: 'sms',
      body: 'OK',
    });
    const replied = await comms.handleInboundReply({
      organizationId: resolved!.organizationId,
      threadId: resolved!.threadId,
      body: 'OK',
    });
    expect(replied!.status).toBe('accepted');
    expect(replied!.method).toBe('sms_reply');
    expect(replied!.responseText).toBe('OK');

    const messages = await comms.listMessages(ctx(), resolved!.threadId);
    expect(messages.some((m) => m.direction === 'inbound')).toBe(true);
    expect(result.acceptance.caseId).toBe(caseId);
  });

  it('a non-keyword reply does NOT auto-accept', async () => {
    await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4793333333',
      siteUrl: 'https://app.example.no',
    });
    const resolved = await comms.resolveOpenThreadByContact(
      'sms',
      '+4793333333',
    );
    const reply = await comms.handleInboundReply({
      organizationId: resolved!.organizationId,
      threadId: resolved!.threadId,
      body: 'Jeg har et spørsmål om prisen',
    });
    expect(reply).toBeNull();
  });

  it('staff can record a manual (in-person) acceptance', async () => {
    const manual = await comms.recordManualAcceptance(
      ctx(),
      caseId,
      'Kunde godkjente på verkstedet',
    );
    expect(manual.status).toBe('accepted');
    expect(manual.method).toBe('manual');
  });
});
