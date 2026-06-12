import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Primary-flow E2E (Sprint 12 milestone gate, extended Batch 7).
 *
 * Drives a single case through the WHOLE operator lifecycle against real
 * Postgres, exercising every module together in the order the workshop runs:
 *
 *   intake (customer + vehicle + insured case)
 *     → estimate import + lock (DBS payload)
 *     → customer acceptance (SMS jobcard)
 *     → parts coordinator (flag → order → receive)
 *     → production workflow (received → … → ready_for_delivery)
 *     → segment work (planned + clocked-in + clocked-out + completed)
 *     → QC delivery checklist passes
 *     → handover signed + delivered
 *     → finance (invoice bases generated → approved → exported)
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
  let estimating: typeof import('@/modules/estimating/public');
  let parts: typeof import('@/modules/parts/public');
  let workforce: typeof import('@/modules/workforce/public');
  let finance: typeof import('@/modules/finance/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let fremtindId: string;
  let caseId: string;
  let employeeId: string;

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
    estimating = await import('@/modules/estimating/public');
    parts = await import('@/modules/parts/public');
    workforce = await import('@/modules/workforce/public');
    finance = await import('@/modules/finance/public');

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

    // Insurance company (Fremtind) is needed for the funding source so the
    // walkthrough exercises a real insurance + deductible split into two
    // invoice bases at finance time.
    const insurers = await h.admin`
      SELECT id FROM insurance_companies WHERE code = 'fremtind'
    `;
    if (insurers[0]) {
      fremtindId = insurers[0]['id'] as string;
    } else {
      const f = await h.admin`
        INSERT INTO insurance_companies (code, name)
        VALUES ('fremtind', 'Fremtind') RETURNING id
      `;
      fremtindId = f[0]!['id'] as string;
    }
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

  it('intake: customer + vehicle + case (with insurance funding + deductible)', async () => {
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
      fundingSources: [
        {
          kind: 'insurance',
          label: 'Fremtind',
          newClaim: {
            claimNumber: 'E2E-FR-100',
            insuranceCompanyId: fremtindId,
          },
          deductibleAmount: 6000,
          deductiblePayerCustomerId: cust.id,
        },
      ],
    });
    caseId = created.id;
    expect(created.caseNumber).toBeTruthy();

    // Funding sources are created in draft state by intake; the operator
    // (or downstream booking flow) activates them. Mirror that here so the
    // finance basis generator can see the source later.
    await h.admin`
      UPDATE case_funding_sources SET status = 'active'
      WHERE organization_id = ${orgId} AND case_id = ${caseId}
    `;
  });

  it('estimate: import DBS payload + lock', async () => {
    const imported = await estimating.importDbsEstimate(ctx(), {
      caseId,
      payload: {
        oppdragsId: 'E2E-1',
        skadenr: 'E2E-FR-100',
        document: {
          estimateNumber: 'E2E-EST-1',
          insurerName: 'Fremtind',
          vehicleDescription: 'Volvo V60',
          vin: 'YV1FW6BS3M1234567',
          normalRepairDays: 6,
        },
        operations: [
          {
            category: 'body_labor',
            description: 'H Forskjerm',
            action: 'Skift',
            timePeriods: 3260,
            laborRate: 955,
          },
        ],
        paintLines: [
          { description: 'Lakkarbeide', timePeriods: 1091, laborRate: 1175 },
        ],
        parts: [
          {
            partNumber: '9831194480',
            description: 'H Forskjerm',
            listPrice: 4083.66,
            amount: 4083.66,
          },
        ],
        totals: {
          bodyLaborPeriods: 3260,
          paintLaborPeriods: 1091,
          bodyLaborAmount: 31133,
          paintLaborAmount: 12819,
          paintMaterialAmount: 2000,
          partsAmount: 4084,
          vatRate: 25,
          totalAmount: 311841,
        },
      },
    });
    await estimating.lockEstimate(ctx(), imported.id);

    const totals = await estimating.getTotals(ctx(), imported.id);
    expect(totals).not.toBeNull();
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

  it('parts: coordinator orders + receives a flagged requirement', async () => {
    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'H Forskjerm',
      partNumber: '9831194480',
      quantity: 1,
    });
    expect(requirement.status).toBe('needed');

    const supplier = await parts.createSupplier(ctx(), {
      name: 'Reservedeler AS',
    });
    await parts.createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      poNumber: 'E2E-PO-100',
      lines: [
        {
          partRequirementId: requirement.id,
          caseId,
          description: 'H Forskjerm',
          quantity: 1,
          unitPrice: '4083.66',
        },
      ],
    });

    const openLines = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(openLines).toHaveLength(1);
    await parts.receiveParts(ctx(), {
      purchaseOrderId: openLines[0]!.purchaseOrderId,
      lines: [
        { purchaseOrderLineId: openLines[0]!.poLineId, quantityReceived: 1 },
      ],
    });

    const reconciled = await parts.reconcileCaseParts(ctx(), caseId);
    const row = reconciled.find((r) => r.requirement.id === requirement.id)!;
    expect(row.requirement.status).toBe('received');
    expect(row.reconciliation.isFulfilled).toBe(true);
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

  it('segment work: planned, clocked, and completed by a tekniker', async () => {
    // Create the tekniker once (used by clock-in below).
    const employee = await workforce.createEmployee(ctx(), {
      fullName: 'Erik Tekniker',
      skills: [{ skillCode: 'paint', proficiency: 'qualified' }],
    });
    employeeId = employee.id;

    const segment = await production.addWorkSegment(ctx(), {
      caseId,
      segmentCode: 'paint_application',
      plannedMinutes: 120,
    });

    // Operator clocks in on the planned segment, then clocks out — exactly
    // what My Tasks does on the floor. The clock service writes the event
    // tier time entry tagged to caseId + segmentCode.
    const session = await workforce.clockIn(ctx(), {
      employeeId,
      segmentCode: 'paint_application',
      caseId,
      workSegmentId: segment.id,
    });
    expect(session.status).toBe('open');
    await workforce.clockOut(ctx(), employeeId);

    const entries = await workforce.listTimeEntries(ctx(), employeeId);
    const entry = entries.find((e) => e.segmentCode === 'paint_application');
    expect(entry).toBeDefined();
    expect(entry!.caseId).toBe(caseId);

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

  it('finance: invoice bases generated → approved → exported', async () => {
    // Insurance + deductible funding should produce TWO bases: the insurance
    // basis (net of deductible) and the deductible basis to the customer.
    const generated = await finance.generateInvoiceBasisForCase(ctx(), caseId);
    expect(generated.bases.length).toBe(2);

    const bases = await finance.listInvoiceBasesForCase(ctx(), caseId);
    const insuranceBasis = bases.find((b) => b.kind === 'standard')!;
    const deductibleBasis = bases.find((b) => b.kind === 'deductible')!;
    expect(insuranceBasis).toBeDefined();
    expect(deductibleBasis).toBeDefined();
    expect(Number(deductibleBasis.netAmount)).toBe(6000);

    for (const basis of bases) {
      const approved = await finance.approveInvoiceBasis(ctx(), basis.id);
      expect(approved.status).toBe('approved');
    }

    const exp = await finance.exportApprovedBases(ctx());
    expect(exp.payloadHash).toBeTruthy();

    const after = await finance.listInvoiceBasesForCase(ctx(), caseId);
    expect(after.every((b) => b.status === 'exported')).toBe(true);
  });
});
