import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Planner ↔ office tasks integration (D3 Phase E).
 *
 * Validates against real Postgres that the read paths used by the production
 * planner (My Tasks, Day, Week) see office tasks in the same shape office-
 * tasks.test.ts created them.
 */
describe('planner office tasks (D3 Phase E)', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000d3e01';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'd3e-owner@example.no',
      fullName: 'Owner E',
    });
    const a = await identity.createOrganizationWithOwner({
      name: 'D3 Planner Workshop',
      ownerUserId,
    });
    orgId = a.organization.id;
    const [ws] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgId}, 'Drammen') RETURNING id
    `;
    workshopId = ws!['id'] as string;

    const c = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Customer E',
    });
    const caseRow = await caseModule.createCase(ctx(), {
      primaryCustomerId: c.id,
      fundingSources: [],
    });
    caseId = caseRow.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctx = () => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId,
    accessibleWorkshopIds: [workshopId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d3e99',
  });

  it('listOpenOfficeTasksForOrg surfaces tasks the planner needs for Day + Week lanes', async () => {
    // 3 tasks across today and tomorrow.
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 3600_000);

    await workforce.createOfficeTask(ctx(), {
      title: 'Bestill bumper',
      kind: 'order_parts',
      priority: 'high',
      caseId,
      workshopId,
      dueAt: today,
    });
    await workforce.createOfficeTask(ctx(), {
      title: 'Ring kunde',
      kind: 'customer_call',
      priority: 'normal',
      caseId,
      workshopId,
      dueAt: tomorrow,
    });
    await workforce.createOfficeTask(ctx(), {
      title: 'Klargjør faktura',
      kind: 'invoice_prep',
      priority: 'urgent',
      caseId,
      workshopId,
      dueAt: today,
    });

    const open = await workforce.listOpenOfficeTasksForOrg(ctx());
    const titles = open.map((t) => t.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Bestill bumper',
        'Ring kunde',
        'Klargjør faktura',
      ]),
    );

    // Filter "today" the same way Day View does.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 3600_000);
    const todayLane = open.filter(
      (t) => t.dueAt !== null && t.dueAt < endOfToday && t.dueAt >= startOfToday,
    );
    expect(todayLane.length).toBeGreaterThanOrEqual(2);
  });

  it('listMyOpenOfficeTasks returns tasks directly assigned to the user', async () => {
    await workforce.createOfficeTask(ctx(), {
      title: 'Personal follow-up',
      kind: 'customer_followup',
      caseId,
      assigneeUserId: ownerUserId,
    });

    const mine = await workforce.listMyOpenOfficeTasks(ctx(), []);
    const titles = mine.map((t) => t.title);
    expect(titles).toContain('Personal follow-up');
  });

  it('listOfficeTasksForCase returns the case timeline source for the case workspace', async () => {
    const tasks = await workforce.listOfficeTasksForCase(ctx(), caseId);
    // All three tasks from the first test plus the personal follow-up = 4.
    expect(tasks.length).toBeGreaterThanOrEqual(4);
    for (const t of tasks) expect(t.caseId).toBe(caseId);
  });
});
