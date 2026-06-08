import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Production workflow integration suite (Sprint 8).
 *
 * Validates the guardrail end-to-end against real Postgres:
 *   - default workflow seeded (states + transitions, with categories)
 *   - ProductionOrder is a 1:1 container with an initial state
 *   - transitions append to the AUTHORITATIVE append-only history log and
 *     PROJECT onto production_orders.current_state_id AND cases.status
 *   - disallowed transitions are rejected
 *   - state history is immutable (append-only RLS)
 *   - holds are first-class
 */
describe('production workflow', () => {
  let h: IsolationHarness;
  let production: typeof import('@/modules/production/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    production = await import('@/modules/production/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000a8';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner8@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Production Bilskade',
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
      correlationId: '00000000-0000-0000-0000-0000000000fb',
    };
  }

  it('seeds the default workflow (21 states) for the org', async () => {
    await production.seedDefaultWorkflow(orgId);
    const states = await h.admin`
      SELECT count(*)::int AS n FROM workflow_states WHERE organization_id = ${orgId}
    `;
    expect(states[0]!['n']).toBe(21);

    const initial = await h.admin`
      SELECT code FROM workflow_states
      WHERE organization_id = ${orgId} AND is_initial = true
    `;
    expect(initial[0]!['code']).toBe('received');
  });

  it('creates a 1:1 production order container with the initial state', async () => {
    const order = await production.ensureProductionOrder(ctx(), caseId);
    expect(order.caseId).toBe(caseId);
    expect(order.currentStateId).not.toBeNull();

    // Idempotent.
    const again = await production.ensureProductionOrder(ctx(), caseId);
    expect(again.id).toBe(order.id);

    // Initial state recorded in the authoritative history.
    const history = await production.listStateHistory(ctx(), caseId);
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it('transitions append to history and PROJECT onto order + case status', async () => {
    await production.transitionState(ctx(), {
      caseId,
      toStateCode: 'estimated',
    });

    const board = await production.listProductionBoard(ctx());
    const item = board.find((b) => b.caseId === caseId)!;
    expect(item.stateCode).toBe('estimated');

    // cases.status projected from the workflow state category.
    const c = await caseModule.findCaseById(ctx(), caseId);
    expect(c!.status).toBe('intake'); // 'estimated' maps to intake headline

    const history = await production.listStateHistory(ctx(), caseId);
    expect(history[0]!.toStateId).not.toBeNull();
  });

  it('projects a waiting state onto on_hold', async () => {
    await production.transitionState(ctx(), {
      caseId,
      toStateCode: 'approved',
    });
    await production.transitionState(ctx(), {
      caseId,
      toStateCode: 'awaiting_parts',
    });
    const c = await caseModule.findCaseById(ctx(), caseId);
    expect(c!.status).toBe('on_hold');
  });

  it('rejects a transition not defined in the workflow', async () => {
    await expect(
      production.transitionState(ctx(), {
        caseId,
        toStateCode: 'delivered', // not reachable from awaiting_parts
      }),
    ).rejects.toThrow(/TRANSITION_NOT_ALLOWED/);
  });

  it('production_state_history is append-only (RLS rejects UPDATE)', async () => {
    const updated = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`UPDATE production_state_history SET reason = 'tampered'
                WHERE organization_id = ${orgId}`;
    });
    expect(updated.count).toBe(0);
  });

  it('creates and resolves a first-class hold', async () => {
    const hold = await production.createHold(ctx(), {
      caseId,
      holdKind: 'parts',
      reason: 'Backorder',
    });
    let open = await production.listOpenHolds(ctx(), caseId);
    expect(open.some((x) => x.id === hold.id)).toBe(true);

    await production.resolveHold(ctx(), hold.id, 'Parts arrived');
    open = await production.listOpenHolds(ctx(), caseId);
    expect(open.some((x) => x.id === hold.id)).toBe(false);
  });

  it('emits production.state.transitioned to the outbox', async () => {
    const events = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'production.state.transitioned'
    `;
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
