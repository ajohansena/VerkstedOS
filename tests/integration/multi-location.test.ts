import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Multi-location case operations integration suite (Sprint 13). Validates the
 * A → B → A promise against real Postgres: a case transfers between workshops,
 * the active assignment + `current_workshop_id` follow it, the receiving yard
 * sees inbound transfers, validation blocks same-workshop + mid-work transfers,
 * and the single case timeline (assignments) records the whole journey.
 */
describe('multi-location case operations', () => {
  let h: IsolationHarness;
  let identity: typeof import('@/modules/identity/public');
  let caseModule: typeof import('@/modules/case/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopA: string;
  let workshopB: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    identity = await import('@/modules/identity/public');
    caseModule = await import('@/modules/case/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b7';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner13@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Multi Bilskade',
      ownerUserId,
    });
    orgId = organization.id;
    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Verksted A'), (${orgId}, 'Verksted B')
      RETURNING id, name
    `;
    workshopA = ws.find((w) => w['name'] === 'Verksted A')!['id'] as string;
    workshopB = ws.find((w) => w['name'] === 'Verksted B')!['id'] as string;

    const created = await caseModule.createCase(ctxAt(workshopA), {
      fundingSources: [],
    });
    caseId = created.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctxAt(workshopId: string) {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId,
      accessibleWorkshopIds: [workshopA, workshopB],
      correlationId: '00000000-0000-0000-0000-0000000000f3',
    };
  }

  it('places the case at workshop A (initial assignment)', async () => {
    await caseModule.assignCaseToWorkshop(ctxAt(workshopA), {
      caseId,
      workshopId: workshopA,
      role: 'body',
    });
    const c = await h.admin`
      SELECT current_workshop_id FROM cases WHERE id = ${caseId}
    `;
    expect(c[0]!['current_workshop_id']).toBe(workshopA);
  });

  it('rejects a transfer to the same workshop', async () => {
    await expect(
      caseModule.initiateTransfer(ctxAt(workshopA), {
        caseId,
        toWorkshopId: workshopA,
      }),
    ).rejects.toThrow(/SAME_WORKSHOP|allerede/i);
  });

  it('transfers A → B: initiate → accept → arrive flips the case', async () => {
    const transfer = await caseModule.initiateTransfer(ctxAt(workshopA), {
      caseId,
      toWorkshopId: workshopB,
      transportMode: 'tow',
      reason: 'Til lakkering',
    });
    expect(transfer.status).toBe('initiated');
    expect(transfer.fromWorkshopId).toBe(workshopA);

    // The receiving workshop sees it in the yard view.
    const inbound = await caseModule.listInboundTransfers(
      ctxAt(workshopB),
      workshopB,
    );
    expect(inbound.some((t) => t.transfer.id === transfer.id)).toBe(true);

    await caseModule.acceptTransfer(ctxAt(workshopB), transfer.id);
    const arrived = await caseModule.confirmArrival(
      ctxAt(workshopB),
      transfer.id,
      'paint',
    );
    expect(arrived.status).toBe('arrived');

    // The case now lives at B.
    const c = await h.admin`
      SELECT current_workshop_id FROM cases WHERE id = ${caseId}
    `;
    expect(c[0]!['current_workshop_id']).toBe(workshopB);

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'case.transfer.arrived'
    `;
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('transfers B → A back: the case returns home (A → B → A)', async () => {
    const transfer = await caseModule.initiateTransfer(ctxAt(workshopB), {
      caseId,
      toWorkshopId: workshopA,
      reason: 'Til montering',
    });
    await caseModule.acceptTransfer(ctxAt(workshopA), transfer.id);
    await caseModule.confirmArrival(ctxAt(workshopA), transfer.id, 'assembly');

    const c = await h.admin`
      SELECT current_workshop_id FROM cases WHERE id = ${caseId}
    `;
    expect(c[0]!['current_workshop_id']).toBe(workshopA);
  });

  it('the single case timeline shows the full A → B → A journey', async () => {
    const assignments = await caseModule.listAssignments(
      ctxAt(workshopA),
      caseId,
    );
    // body@A, paint@B, assembly@A — repeats to A are allowed.
    expect(assignments.map((a) => a.workshopId)).toEqual([
      workshopA,
      workshopB,
      workshopA,
    ]);
    // Only the last is active.
    const active = assignments.filter((a) => a.status === 'active');
    expect(active.length).toBe(1);
    expect(active[0]!.workshopId).toBe(workshopA);

    const transfers = await caseModule.listTransfers(ctxAt(workshopA), caseId);
    expect(transfers.filter((t) => t.status === 'arrived').length).toBe(2);
  });
});
