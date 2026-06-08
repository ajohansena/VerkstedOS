import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Primary-flow E2E (Sprint 12, milestone gate). Drives a single case through
 * the WHOLE workshop lifecycle against real Postgres, exercising every Sprint's
 * module together: intake → production workflow → segment work → QC sign-off →
 * customer acceptance → digital signature → delivery.
 *
 * This is the domain-level "can a friendly workshop run a case end to end?"
 * proof that gates in CI. (Browser E2E for the same flow would require Supabase
 * auth fixtures + browser binaries; this covers the system behaviour that
 * matters and runs deterministically.)
 */
describe('primary flow (intake → delivery)', () => {
  let h: IsolationHarness;
  let identity: typeof import('@/modules/identity/public');
  let customer: typeof import('@/modules/customer/public');
  let caseModule: typeof import('@/modules/case/public');
  let production: typeof import('@/modules/production/public');
  let quality: typeof import('@/modules/quality/public');
  let comms: typeof import('@/modules/communication/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    identity = await import('@/modules/identity/public');
    customer = await import('@/modules/customer/public');
    caseModule = await import('@/modules/case/public');
    production = await import('@/modules/production/public');
    quality = await import('@/modules/quality/public');
    comms = await import('@/modules/communication/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b6';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner12e@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'E2E Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId,
      accessibleWorkshopIds: [workshopId],
      correlationId: '00000000-0000-0000-0000-0000000000f4',
    };
  }

  it('intake: customer + vehicle + case', async () => {
    const cust = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Kari Nordmann',
      primaryPhone: '+4799887766',
    });
    const vehicle = await customer.createVehicle(ctx(), {
      registrationNumber: 'EK12345',
      make: 'Volvo',
      model: 'V60',
      ownershipType: 'private',
      ownerCustomerId: cust.id,
    });
    const created = await caseModule.createCase(ctx(), {
      primaryCustomerId: cust.id,
      vehicleId: vehicle.id,
      fundingSources: [],
    });
    caseId = created.id;
    expect(created.caseNumber).toBeTruthy();
  });

  it('customer approves the repair start (acceptance gate)', async () => {
    const req = await comms.requestAcceptance(ctx(), {
      caseId,
      channel: 'sms',
      contactValue: '+4799887766',
      summary: 'Bytte støtfanger og lakkere',
      siteUrl: 'https://app.example.no',
    });
    const token = req.jobCardUrl.split('/jobbkort/')[1]!;
    const accepted = await comms.respondViaJobCard(token, 'accepted');
    expect(accepted!.status).toBe('accepted');

    const latest = await comms.latestAcceptance(ctx(), caseId);
    expect(latest!.status).toBe('accepted');
  });

  it('production: workflow advances received → … → ready_for_delivery', async () => {
    await production.seedDefaultWorkflow(orgId);
    await production.ensureProductionOrder(ctx(), caseId);

    const path = [
      'estimated',
      'approved',
      'ready_for_disassembly',
      'in_disassembly',
      'in_body_repair',
      'in_paint_preparation',
      'in_paint_application',
      'in_paint_cure',
      'in_assembly',
      'in_quality_control',
      'ready_for_delivery',
    ];
    for (const toStateCode of path) {
      await production.transitionState(ctx(), { caseId, toStateCode });
    }

    const board = await production.listProductionBoard(ctx());
    const item = board.find((b) => b.caseId === caseId)!;
    expect(item.stateCode).toBe('ready_for_delivery');
  });

  it('segment work: a segment is planned and completed', async () => {
    const segment = await production.addWorkSegment(ctx(), {
      caseId,
      segmentCode: 'paint_application',
      plannedMinutes: 120,
    });
    await production.completeSegment(ctx(), segment.id);
    const segments = await production.listWorkSegments(ctx(), caseId);
    expect(segments.find((s) => s.id === segment.id)!.status).toBe('completed');
  });

  it('QC: a delivery checklist passes', async () => {
    const template = await quality.createChecklistTemplate(ctx(), {
      code: 'delivery',
      name: 'Leveringssjekk',
      kind: 'delivery',
      items: [{ label: 'Lys kontrollert' }, { label: 'Panelspalter' }],
    });
    const run = await quality.startChecklistRun(ctx(), {
      caseId,
      templateId: template.id,
    });
    const items = await quality.listTemplateItems(ctx(), template.id);
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

  it('handover: signed + delivered', async () => {
    // Seal the handover into the case signature chain.
    await quality.appendSignature(ctx(), {
      caseId,
      kind: 'delivery_handover',
      signerName: 'Kari Nordmann',
      payload: JSON.stringify({ handover: true }),
    });
    const chain = await quality.verifyCaseChain(ctx(), caseId);
    expect(chain.valid).toBe(true);

    // Final transition to delivered (terminal).
    await production.transitionState(ctx(), {
      caseId,
      toStateCode: 'delivered',
    });
    const c = await caseModule.findCaseById(ctx(), caseId);
    expect(c!.status).toBe('delivered');
  });
});
