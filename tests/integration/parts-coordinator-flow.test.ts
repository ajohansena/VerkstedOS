import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Parts Coordinator queue actions (Batch 4 — operational workflow).
 *
 * The coordinator queue at /parts now has inline Order + Receive actions on
 * each open requirement. This test exercises the full path through the
 * canonical procurement + receiving services from materialized requirement
 * → ordered PO → received → off the open queue, and asserts the read model
 * exposes the right per-row PO context.
 */
describe('parts: coordinator order + receive flow', () => {
  let h: IsolationHarness;
  let parts: typeof import('@/modules/parts/public');
  let identity: typeof import('@/modules/identity/public');
  let caseModule: typeof import('@/modules/case/public');

  let orgId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    parts = await import('@/modules/parts/public');
    identity = await import('@/modules/identity/public');
    caseModule = await import('@/modules/case/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000d1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'ownerCOORD@example.no',
      fullName: 'Per Coordinator',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Coordinator Bilskade',
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
      correlationId: '00000000-0000-0000-0000-0000000000fb',
    };
  }

  it('order → receive moves a requirement off the open queue with PO traceability preserved', async () => {
    // ── Arrange: a case, a manually-flagged requirement, and a supplier.
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'Frontlykt H',
      partNumber: 'PN-100',
      quantity: 2,
    });
    expect(requirement.status).toBe('needed');

    const supplier = await parts.createSupplier(ctx(), {
      name: 'Reservedeler AS',
    });

    // Sanity: the requirement is on the open queue with no PO context yet.
    const openBefore = await parts.listOpenRequirements(ctx());
    expect(openBefore.some((r) => r.requirement.id === requirement.id)).toBe(
      true,
    );
    const poLinesBefore = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(poLinesBefore).toHaveLength(0);

    // ── Act 1: coordinator orders it (this is what OrderRequirementCell
    // posts to via orderRequirementAction → createPurchaseOrder).
    await parts.createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      poNumber: 'PO-COORD-001',
      lines: [
        {
          partRequirementId: requirement.id,
          caseId,
          description: 'Frontlykt H',
          quantity: 2,
          unitPrice: '4500.00',
        },
      ],
    });

    // The read model now surfaces a single open PO line for this requirement
    // (this is what the ReceiveRequirementCell drawer renders).
    const poLinesAfterOrder = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(poLinesAfterOrder).toHaveLength(1);
    const poLine = poLinesAfterOrder[0]!;
    expect(poLine.poNumber).toBe('PO-COORD-001');
    expect(poLine.supplierName).toBe('Reservedeler AS');
    expect(Number(poLine.quantityOrdered)).toBe(2);
    expect(Number(poLine.quantityReceived)).toBe(0);

    // ── Act 2: coordinator receives the full quantity from the queue.
    await parts.receiveParts(ctx(), {
      purchaseOrderId: poLine.purchaseOrderId,
      lines: [{ purchaseOrderLineId: poLine.poLineId, quantityReceived: 2 }],
    });

    // ── Assert: the PO line is no longer "open" (status flipped to received)
    // so the receive drawer would now be empty for this requirement.
    const poLinesAfterReceive = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(poLinesAfterReceive).toHaveLength(0);

    // ── Assert: requirement status advanced, reconciliation is fulfilled,
    // and the open queue no longer carries it (it moved to "received").
    const reconciled = await parts.reconcileCaseParts(ctx(), caseId);
    const row = reconciled.find((r) => r.requirement.id === requirement.id);
    expect(row).toBeDefined();
    expect(row!.requirement.status).toBe('received');
    expect(row!.reconciliation.isFulfilled).toBe(true);
    expect(row!.reconciliation.state).toBe('received');

    const openAfter = await parts.listOpenRequirements(ctx());
    expect(openAfter.some((r) => r.requirement.id === requirement.id)).toBe(
      false,
    );
  });

  it('partial receive keeps the PO line on the queue with remaining quantity', async () => {
    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    const caseId = created.id;

    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'Støtfanger fram',
      quantity: 3,
    });
    const supplier = await parts.createSupplier(ctx(), {
      name: 'Karosserideler AS',
    });

    await parts.createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      poNumber: 'PO-COORD-002',
      lines: [
        {
          partRequirementId: requirement.id,
          caseId,
          description: 'Støtfanger fram',
          quantity: 3,
        },
      ],
    });

    const before = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(before).toHaveLength(1);

    await parts.receiveParts(ctx(), {
      purchaseOrderId: before[0]!.purchaseOrderId,
      lines: [
        { purchaseOrderLineId: before[0]!.poLineId, quantityReceived: 1 },
      ],
    });

    // Still open: 1 of 3 received, 2 outstanding.
    const after = await parts.listOpenPoLinesForRequirement(
      ctx(),
      requirement.id,
    );
    expect(after).toHaveLength(1);
    expect(Number(after[0]!.quantityReceived)).toBe(1);
    expect(Number(after[0]!.quantityOrdered)).toBe(3);

    // Requirement moved to partially_received, still on the coordinator queue.
    const openAfter = await parts.listOpenRequirements(ctx());
    const stillOpen = openAfter.find(
      (r) => r.requirement.id === requirement.id,
    );
    expect(stillOpen).toBeDefined();
    expect(stillOpen!.requirement.status).toBe('partially_received');
  });
});
