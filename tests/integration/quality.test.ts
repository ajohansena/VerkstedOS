import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Quality control integration suite (Sprint 12).
 *
 * Validates the QC flow against real Postgres: a per-workshop template with
 * items, a run started against a case, fail-requires-comment enforcement, the
 * pass/fail status DERIVED at sign-off, and a quality deviation linked to the
 * internal-rework funding source (kept separable for the rework KPI).
 */
describe('quality control', () => {
  let h: IsolationHarness;
  let quality: typeof import('@/modules/quality/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;
  let templateId: string;
  let workshopId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    quality = await import('@/modules/quality/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b3';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner12q@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Kvalitet Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

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
      correlationId: '00000000-0000-0000-0000-0000000000f7',
    };
  }

  it('creates a delivery checklist template with items', async () => {
    const template = await quality.createChecklistTemplate(ctx(), {
      code: 'delivery',
      name: 'Leveringssjekk',
      kind: 'delivery',
      items: [
        { label: 'Lys kontrollert' },
        { label: 'Lakkkvalitet kontrollert', requiresCommentOnFail: true },
      ],
    });
    templateId = template.id;

    const items = await quality.listTemplateItems(ctx(), templateId);
    expect(items.length).toBe(2);
    expect(items[0]!.sequenceNo).toBe(0);
  });

  it('runs a checklist and enforces comment-on-fail', async () => {
    const run = await quality.startChecklistRun(ctx(), {
      caseId,
      templateId,
    });
    expect(run.status).toBe('in_progress');

    const items = await quality.listTemplateItems(ctx(), templateId);
    const lightsItem = items[0]!;
    const paintItem = items[1]!;

    // Passing item is fine.
    await quality.respondToItem(ctx(), {
      runId: run.id,
      templateItemId: lightsItem.id,
      result: 'pass',
    });

    // Failing the paint item WITHOUT a comment is rejected.
    await expect(
      quality.respondToItem(ctx(), {
        runId: run.id,
        templateItemId: paintItem.id,
        result: 'fail',
      }),
    ).rejects.toThrow(/COMMENT_REQUIRED|påkrevd/i);

    // With a comment it succeeds.
    await quality.respondToItem(ctx(), {
      runId: run.id,
      templateItemId: paintItem.id,
      result: 'fail',
      comment: 'Appelsinhud på panseret',
    });

    // Sign-off derives FAILED (a required item failed).
    const signed = await quality.signOffRun(ctx(), run.id);
    expect(signed.status).toBe('failed');
    expect(signed.signedOffByUserId).toBe(ownerUserId);

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'quality.checklist.signed_off'
    `;
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('passes a run when all required items pass', async () => {
    const run = await quality.startChecklistRun(ctx(), { caseId, templateId });
    const items = await quality.listTemplateItems(ctx(), templateId);
    for (const item of items) {
      await quality.respondToItem(ctx(), {
        runId: run.id,
        templateItemId: item.id,
        result: 'pass',
      });
    }
    const signed = await quality.signOffRun(ctx(), run.id);
    expect(signed.status).toBe('passed');
  });

  it('raises and resolves a quality deviation (rework separable)', async () => {
    await caseModule.addFundingSource(
      ctx(),
      caseId,
      {
        kind: 'internal_rework',
        label: 'Omlakkering',
        referencesCaseId: caseId,
        reworkReason: 'Lakkfeil',
        reworkOwnerWorkshopId: workshopId,
      },
      1,
    );
    const funding = (await caseModule.listFundingSources(ctx(), caseId)).find(
      (f) => f.kind === 'internal_rework',
    )!;

    const deviation = await quality.raiseDeviation(ctx(), {
      caseId,
      title: 'Lakkfeil på panser',
      severity: 'major',
      reworkFundingSourceId: funding.id,
    });
    expect(deviation.status).toBe('open');
    expect(deviation.reworkFundingSourceId).toBe(funding.id);

    await quality.resolveDeviation(ctx(), deviation.id, 'Omlakkert');
    const list = await quality.listDeviations(ctx(), caseId);
    expect(list.find((d) => d.id === deviation.id)!.status).toBe('resolved');
  });

  it('computes QC failure rate via the canonical calculation', () => {
    const result = quality.calculateQcFailureRate([
      { status: 'passed' },
      { status: 'failed' },
    ]);
    expect(result.rate).toBeCloseTo(0.5);
  });
});
