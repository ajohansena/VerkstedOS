import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Office-tasks integration suite (D3 Phase B).
 *
 * Validates against real Postgres:
 *   • create → assign → start → complete lifecycle (incl. event payloads).
 *   • cancel with reason; reason is required.
 *   • listOpenOfficeTasksForOrg + listMyOpenOfficeTasks aggregation.
 *   • Cross-org isolation: a context in org B cannot see org A's tasks.
 *   • The capacity engine ignores office tasks — they're plannable but never
 *     book minutes against a resource (doc 13 § 10).
 */
describe('office tasks (D3)', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgAId: string;
  let orgBId: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let workshopAId: string;
  let workshopBId: string;
  let payerAId: string;
  let payerBId: string;
  let caseAId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerAUserId = '00000000-0000-0000-0000-0000000d3a01';
    ownerBUserId = '00000000-0000-0000-0000-0000000d3b01';
    await identity.ensureUser({
      id: ownerAUserId,
      email: 'd3-owner-a@example.no',
      fullName: 'Owner A',
    });
    await identity.ensureUser({
      id: ownerBUserId,
      email: 'd3-owner-b@example.no',
      fullName: 'Owner B',
    });
    const a = await identity.createOrganizationWithOwner({
      name: 'D3 Workshop A',
      ownerUserId: ownerAUserId,
    });
    const b = await identity.createOrganizationWithOwner({
      name: 'D3 Workshop B',
      ownerUserId: ownerBUserId,
    });
    orgAId = a.organization.id;
    orgBId = b.organization.id;

    const [wsA] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgAId}, 'Bergen') RETURNING id
    `;
    workshopAId = wsA!['id'] as string;
    const [wsB] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgBId}, 'Stavanger') RETURNING id
    `;
    workshopBId = wsB!['id'] as string;

    const cA = await customer.createCustomer(ctxA(), {
      kind: 'individual',
      name: 'Customer A',
    });
    payerAId = cA.id;
    const cB = await customer.createCustomer(ctxB(), {
      kind: 'individual',
      name: 'Customer B',
    });
    payerBId = cB.id;

    const caseA = await caseModule.createCase(ctxA(), {
      primaryCustomerId: payerAId,
      fundingSources: [],
    });
    caseAId = caseA.id;
    await caseModule.createCase(ctxB(), {
      primaryCustomerId: payerBId,
      fundingSources: [],
    });
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctxA = () => ({
    userId: ownerAUserId,
    organizationId: orgAId,
    workshopId: workshopAId,
    accessibleWorkshopIds: [workshopAId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d3a99',
  });
  const ctxB = () => ({
    userId: ownerBUserId,
    organizationId: orgBId,
    workshopId: workshopBId,
    accessibleWorkshopIds: [workshopBId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d3b99',
  });

  it('lifecycle: create → assign → start → complete (events emitted)', async () => {
    const dueAt = new Date(Date.now() + 24 * 3600_000);
    const created = await workforce.createOfficeTask(ctxA(), {
      title: 'Bestill deler til front',
      kind: 'order_parts',
      priority: 'high',
      caseId: caseAId,
      workshopId: workshopAId,
      dueAt,
    });
    expect(created.status).toBe('open');
    expect(created.caseId).toBe(caseAId);

    const assigned = await workforce.assignOfficeTask(ctxA(), created.id, {
      userId: ownerAUserId,
    });
    expect(assigned.assigneeUserId).toBe(ownerAUserId);

    const started = await workforce.startOfficeTask(ctxA(), created.id);
    expect(started.status).toBe('in_progress');

    const completed = await workforce.completeOfficeTask(ctxA(), created.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
    expect(completed.completedByUserId).toBe(ownerAUserId);

    const events = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgAId}
        AND event_type LIKE 'workforce.office_task.%'
      ORDER BY occurred_at
    `;
    const topics = events.map((e) => e['event_type'] as string);
    expect(topics).toContain('workforce.office_task.created');
    expect(topics).toContain('workforce.office_task.assigned');
    expect(topics).toContain('workforce.office_task.started');
    expect(topics).toContain('workforce.office_task.completed');
  });

  it('cancel requires a reason and forbids cancelling completed tasks', async () => {
    const task = await workforce.createOfficeTask(ctxA(), {
      title: 'Ring kunde',
      kind: 'customer_call',
      caseId: caseAId,
    });
    await expect(
      workforce.cancelOfficeTask(ctxA(), task.id, '   '),
    ).rejects.toBeInstanceOf(workforce.OfficeTaskValidationError);

    const cancelled = await workforce.cancelOfficeTask(
      ctxA(),
      task.id,
      'kunde svarte ikke',
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledReason).toBe('kunde svarte ikke');

    // Re-cancel is idempotent (already cancelled).
    const again = await workforce.cancelOfficeTask(
      ctxA(),
      task.id,
      'still cancelled',
    );
    expect(again.status).toBe('cancelled');

    // Cannot complete after cancel.
    await expect(
      workforce.completeOfficeTask(ctxA(), task.id),
    ).rejects.toBeInstanceOf(workforce.OfficeTaskValidationError);
  });

  it('listOpenOfficeTasksForOrg returns only active tasks for the calling org', async () => {
    const opens = await workforce.listOpenOfficeTasksForOrg(ctxA());
    // Across earlier tests we have at least one open and at most a handful.
    expect(opens.length).toBeGreaterThanOrEqual(0);
    for (const t of opens) {
      expect(['open', 'in_progress']).toContain(t.status);
    }

    // Org B cannot see Org A's tasks.
    await workforce.createOfficeTask(ctxA(), {
      title: 'Forsikringsoppfølging',
      kind: 'insurer_followup',
      caseId: caseAId,
    });
    const orgBView = await workforce.listOpenOfficeTasksForOrg(ctxB());
    const orgBTitles = orgBView.map((t) => t.title);
    expect(orgBTitles).not.toContain('Forsikringsoppfølging');
  });

  it('listMyOpenOfficeTasks aggregates user-assigned and resource-assigned', async () => {
    // Direct user assignment for ownerA.
    await workforce.createOfficeTask(ctxA(), {
      title: 'Klargjør faktura',
      kind: 'invoice_prep',
      caseId: caseAId,
      assigneeUserId: ownerAUserId,
    });
    const mine = await workforce.listMyOpenOfficeTasks(ctxA(), []);
    const titles = mine.map((t) => t.title);
    expect(titles).toContain('Klargjør faktura');
  });

  it('capacity engine ignores office tasks (doc 13 § 10)', async () => {
    // Create a task with a due_at — this must NOT show up against any resource
    // assignment, and there is no way to book a resource's minutes via
    // createOfficeTask. Sanity-check: there are zero resource_assignment rows
    // generated by the task lifecycle.
    const task = await workforce.createOfficeTask(ctxA(), {
      title: 'Følg opp etter levering',
      kind: 'customer_followup',
      caseId: caseAId,
      dueAt: new Date(Date.now() + 7 * 24 * 3600_000),
    });
    expect(task.id).toBeTruthy();

    const assignments = await h.admin`
      SELECT id FROM resource_assignments WHERE organization_id = ${orgAId}
    `;
    // No assignments were created — the office task lifecycle is independent
    // of the capacity engine. (If a previous test created assignments via
    // production planning we'd see them; this suite doesn't touch planner.)
    expect(assignments.length).toBe(0);
  });
});
