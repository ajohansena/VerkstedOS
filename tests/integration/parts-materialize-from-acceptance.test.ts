import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Part-requirement materialization from approved estimate (Sprint 21 fix).
 *
 * Binding rule (docs/03-data-model.md, parts spine): when the customer (or
 * staff via manual acceptance) APPROVES the repair, the locked estimate's
 * part lines must become `part_requirements` so the Parts Coordinator queue
 * actually has work to do. The trigger is the approval — NOT the DBS import
 * and NOT the estimate lock (estimates can be revised many times before
 * approval).
 */
describe('parts: materialize from approved estimate', () => {
  let h: IsolationHarness;
  let parts: typeof import('@/modules/parts/public');
  let comms: typeof import('@/modules/communication/public');
  let caseModule: typeof import('@/modules/case/public');
  let estimating: typeof import('@/modules/estimating/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    parts = await import('@/modules/parts/public');
    comms = await import('@/modules/communication/public');
    caseModule = await import('@/modules/case/public');
    estimating = await import('@/modules/estimating/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000c1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'ownerMAT@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Materialize Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
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
      correlationId: '00000000-0000-0000-0000-0000000000fa',
    };
  }

  /** Helper: receive + lock a DBS estimate with two part lines on a case. */
  async function importAndLockEstimateWithTwoParts(
    caseId: string,
    skadenr = 'SK-1001',
  ): Promise<{ importId: string }> {
    const payload = {
      oppdragsId: `OPP-${skadenr}`,
      skadenr,
      document: {
        estimateNumber: skadenr,
        registrationNumber: 'AB12345',
        vehicleDescription: 'TestMerke TestModell',
      },
      parts: [
        {
          partNumber: 'PN-001',
          description: 'Frontlykt H',
          listPrice: '4500.00',
          discountFactor: '1,0',
          amount: '4500.00',
        },
        {
          partNumber: 'PN-002',
          description: 'Støtfanger fram',
          listPrice: '8200.00',
          discountFactor: '1,0',
          amount: '8200.00',
        },
      ],
      operations: [],
      laborLines: [],
      paintLines: [],
    };
    const inbox = await estimating.receiveDbsPayload({
      organizationId: orgId,
      payload,
    });
    const imported = await estimating.importDbsEstimate(ctx(), {
      inboxId: inbox.inboxId,
      caseId,
      payload,
    });
    await estimating.lockEstimate(ctx(), imported.id);
    return { importId: imported.id };
  }

  it('manual acceptance materializes one requirement per estimate part', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    await importAndLockEstimateWithTwoParts(caseId, 'SK-MAN-1');

    // Sanity: no requirements yet (the trigger is the approval, not the lock).
    const beforeReqs = await parts.listPartRequirements(ctx(), caseId);
    expect(beforeReqs).toHaveLength(0);

    await comms.recordManualAcceptance(
      ctx(),
      caseId,
      'Kunde godkjente på verkstedet',
    );

    const afterReqs = await parts.listPartRequirements(ctx(), caseId);
    expect(afterReqs).toHaveLength(2);
    expect(afterReqs.every((r) => r.source === 'estimate')).toBe(true);
    expect(afterReqs.every((r) => r.status === 'needed')).toBe(true);
    expect(afterReqs.every((r) => r.estimatePartId != null)).toBe(true);
    // DBS does not provide quantity; default 1 is documented and verified.
    expect(afterReqs.every((r) => r.quantity === '1.000')).toBe(true);
    expect(afterReqs.map((r) => r.partNumber).sort()).toEqual([
      'PN-001',
      'PN-002',
    ]);

    // Coordinator queue now has work to do (the user-visible symptom is fixed).
    const open = await parts.listOpenRequirements(ctx());
    const forCase = open.filter((r) => r.requirement.caseId === caseId);
    expect(forCase).toHaveLength(2);
  });

  it('customer acceptance via job-card link triggers the same materialization', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    await importAndLockEstimateWithTwoParts(caseId, 'SK-JC-1');

    const req = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4799000111',
      siteUrl: 'https://app.example.no',
    });
    const token = req.jobCardUrl.split('/jobbkort/')[1]!;
    const responded = await comms.respondViaJobCard(token, 'accepted');
    expect(responded!.status).toBe('accepted');

    const reqs = await parts.listPartRequirements(ctx(), caseId);
    expect(reqs).toHaveLength(2);
    expect(reqs.every((r) => r.source === 'estimate')).toBe(true);
  });

  it('materialization is idempotent (re-running acceptance does not duplicate)', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    await importAndLockEstimateWithTwoParts(caseId, 'SK-IDEM-1');
    await comms.recordManualAcceptance(ctx(), caseId, 'first manual');
    const first = await parts.listPartRequirements(ctx(), caseId);
    expect(first).toHaveLength(2);

    // A second manual acceptance must not duplicate requirements.
    await comms.recordManualAcceptance(ctx(), caseId, 'second manual');
    const second = await parts.listPartRequirements(ctx(), caseId);
    expect(second).toHaveLength(2);

    // Direct call to the public materializer is also idempotent.
    const result = await parts.materializeRequirementsFromApprovedEstimate(
      ctx(),
      caseId,
    );
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_materialized');
    expect(result.created).toBe(0);
  });

  it('declined acceptance does NOT materialize requirements', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    await importAndLockEstimateWithTwoParts(caseId, 'SK-DEC-1');

    const req = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4799000222',
      siteUrl: 'https://app.example.no',
    });
    const token = req.jobCardUrl.split('/jobbkort/')[1]!;
    const declined = await comms.respondViaJobCard(token, 'declined');
    expect(declined!.status).toBe('declined');

    const reqs = await parts.listPartRequirements(ctx(), caseId);
    expect(reqs).toHaveLength(0);
  });

  it('approval without a locked estimate skips cleanly', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    // No estimate at all — approval should not throw.
    await comms.recordManualAcceptance(ctx(), caseId, 'no estimate');
    const reqs = await parts.listPartRequirements(ctx(), caseId);
    expect(reqs).toHaveLength(0);

    const result = await parts.materializeRequirementsFromApprovedEstimate(
      ctx(),
      caseId,
    );
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_locked_estimate');
  });
});
