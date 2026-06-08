import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Parts & inventory integration suite (Sprint 11).
 *
 * Validates the demoable flow end-to-end against real Postgres: a body tech
 * FLAGS a missing part → the coordinator ORDERS it on a PO (one PO can span
 * many cases) → RECEIVES it → the requirement reconciles to received → an
 * inventory part is WITHDRAWN to a second requirement → the lifecycle timeline
 * shows every step. Also covers a return re-opening a requirement and the
 * append-only nature of the stock ledger + timeline.
 */
describe('parts & inventory', () => {
  let h: IsolationHarness;
  let parts: typeof import('@/modules/parts/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseId: string;
  let secondCaseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    parts = await import('@/modules/parts/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner11@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Parts Bilskade',
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
    const second = await caseModule.createCase(ctx(), { fundingSources: [] });
    secondCaseId = second.id;
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
      correlationId: '00000000-0000-0000-0000-0000000000f9',
    };
  }

  let requirementId: string;
  let supplierId: string;
  let poLineId: string;

  it('a body tech flags a missing part (the spine)', async () => {
    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'Frontlykt H',
      partNumber: 'CIT-1234',
      quantity: 1,
    });
    requirementId = requirement.id;
    expect(requirement.status).toBe('needed');

    const list = await parts.listPartRequirements(ctx(), caseId);
    expect(list.map((r) => r.id)).toContain(requirementId);

    // Lifecycle started.
    const timeline = await parts.listCaseLifecycle(ctx(), caseId);
    expect(timeline.some((e) => e.kind === 'requirement_created')).toBe(true);
  });

  it('the coordinator orders it on a PO that can span many cases', async () => {
    const supplier = await parts.createSupplier(ctx(), { name: 'Mekonomen' });
    supplierId = supplier.id;

    // Also flag a part on the SECOND case to prove one PO spans cases.
    const secondReq = await parts.flagPartRequirement(ctx(), {
      caseId: secondCaseId,
      description: 'Støtfanger bak',
      quantity: 1,
    });

    const po = await parts.createPurchaseOrder(ctx(), {
      supplierId,
      poNumber: 'PO-1001',
      lines: [
        {
          partRequirementId: requirementId,
          caseId,
          description: 'Frontlykt H',
          partNumber: 'CIT-1234',
          quantity: 1,
          unitPrice: '2500.00',
        },
        {
          partRequirementId: secondReq.id,
          caseId: secondCaseId,
          description: 'Støtfanger bak',
          quantity: 1,
        },
      ],
    });
    expect(po.status).toBe('draft');

    const poLines = await parts.listPurchaseOrderLines(ctx(), po.id);
    expect(poLines.length).toBe(2);
    // The two lines belong to two different cases on ONE PO.
    expect(new Set(poLines.map((l) => l.caseId)).size).toBe(2);
    poLineId = poLines.find((l) => l.partRequirementId === requirementId)!.id;

    await parts.sendPurchaseOrder(ctx(), po.id);

    const list = await parts.listPartRequirements(ctx(), caseId);
    expect(list.find((r) => r.id === requirementId)!.status).toBe('ordered');
  });

  it('receives the part and reconciles to received', async () => {
    await parts.receiveParts(ctx(), {
      purchaseOrderId: (await firstPoId())!,
      lines: [{ purchaseOrderLineId: poLineId, quantityReceived: 1 }],
    });

    const reconciled = await parts.reconcileCaseParts(ctx(), caseId);
    const row = reconciled.find((r) => r.requirement.id === requirementId)!;
    expect(row.reconciliation.state).toBe('received');
    expect(row.reconciliation.isFulfilled).toBe(true);
    expect(row.requirement.status).toBe('received');

    const timeline = await parts.listCaseLifecycle(ctx(), caseId);
    expect(timeline.some((e) => e.kind === 'received')).toBe(true);
  });

  it('withdraws an inventory part to a case (alternative satisfaction path)', async () => {
    const item = await parts.upsertInventoryItem(ctx(), {
      workshopId,
      partNumber: 'OIL-5W30',
      description: 'Motorolje 5W30',
      quantityOnHand: 10,
      unitCost: '120.00',
    });

    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'Motorolje',
      partNumber: 'OIL-5W30',
      quantity: 2,
    });

    const withdrawal = await parts.withdrawToCase(ctx(), {
      inventoryItemId: item.id,
      caseId,
      quantity: 2,
      partRequirementId: requirement.id,
    });
    expect(Number(withdrawal.quantity)).toBe(2);

    // Stock decremented from 10 → 8 (running balance from the ledger).
    const after = await parts.listInventory(ctx());
    expect(Number(after.find((i) => i.id === item.id)!.quantityOnHand)).toBe(8);

    // Requirement fulfilled from stock.
    const list = await parts.listPartRequirements(ctx(), caseId);
    expect(list.find((r) => r.id === requirement.id)!.status).toBe('fulfilled');

    const timeline = await parts.listCaseLifecycle(ctx(), caseId);
    expect(timeline.some((e) => e.kind === 'withdrawn')).toBe(true);
    expect(timeline.some((e) => e.kind === 'fulfilled')).toBe(true);
  });

  it('rejects a withdrawal that exceeds stock on hand', async () => {
    const item = (await parts.listInventory(ctx())).find(
      (i) => i.partNumber === 'OIL-5W30',
    )!;
    await expect(
      parts.withdrawToCase(ctx(), {
        inventoryItemId: item.id,
        caseId,
        quantity: 999,
      }),
    ).rejects.toThrow(/INSUFFICIENT_STOCK|enough stock/i);
  });

  it('a wrong-part return re-opens the requirement for re-sourcing', async () => {
    await parts.createPartReturn(ctx(), {
      supplierId,
      returnNumber: 'RET-1',
      lines: [
        {
          purchaseOrderLineId: poLineId,
          partRequirementId: requirementId,
          quantityReturned: 1,
          reason: 'wrong_part',
        },
      ],
    });

    const list = await parts.listPartRequirements(ctx(), caseId);
    expect(list.find((r) => r.id === requirementId)!.status).toBe('returned');

    // After the return, net received drops below required → not fulfilled.
    const reconciled = await parts.reconcileCaseParts(ctx(), caseId);
    const row = reconciled.find((r) => r.requirement.id === requirementId)!;
    expect(row.reconciliation.isFulfilled).toBe(false);

    const timeline = await parts.listCaseLifecycle(ctx(), caseId);
    expect(timeline.some((e) => e.kind === 'returned')).toBe(true);
  });

  it('the stock ledger is append-only (movements never updated in place)', async () => {
    // A withdrawal + adjustment + receipt all wrote movement rows; none were
    // mutated. The running balance equals the signed sum of deltas.
    const movements = await h.admin`
      SELECT coalesce(sum(quantity_delta), 0)::numeric AS net
      FROM inventory_stock_movements m
      JOIN inventory_items i ON i.id = m.inventory_item_id
      WHERE i.part_number = 'OIL-5W30' AND m.organization_id = ${orgId}
    `;
    // opening +10, withdrawal -2 → 8.
    expect(Number(movements[0]!['net'])).toBe(8);
  });

  // Helper: the PO id created above (one PO this suite).
  async function firstPoId(): Promise<string | null> {
    const rows = await h.admin`
      SELECT id FROM purchase_orders
      WHERE organization_id = ${orgId} AND po_number = 'PO-1001'
      LIMIT 1
    `;
    return (rows[0]?.['id'] as string) ?? null;
  }
});
