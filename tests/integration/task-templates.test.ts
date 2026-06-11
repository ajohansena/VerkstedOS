import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Task-templates integration suite (D3 Phase F).
 *
 * Validates against real Postgres:
 *   • createTaskTemplate + listActiveTaskTemplatesForEvent.
 *   • evaluateAndGenerate creates an office task with provenance set.
 *   • Replay of the same outbox event is idempotent (unique partial index).
 *   • triggerEventFilter narrows generation (no-match → no task).
 */
describe('task templates (D3 Phase F)', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let caseModule: typeof import('@/modules/case/public');
  let customer: typeof import('@/modules/customer/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let payerId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    caseModule = await import('@/modules/case/public');
    customer = await import('@/modules/customer/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000d3f01';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'd3-tpl-owner@example.no',
      fullName: 'Template Owner',
    });
    const org = await identity.createOrganizationWithOwner({
      name: 'D3 Template Org',
      ownerUserId,
    });
    orgId = org.organization.id;

    const [ws] = await h.admin`
      INSERT INTO workshops (organization_id, name) VALUES (${orgId}, 'Tromsø') RETURNING id
    `;
    workshopId = ws!['id'] as string;

    const cust = await customer.createCustomer(ctx(), {
      kind: 'individual',
      name: 'Template Customer',
    });
    payerId = cust.id;

    const createdCase = await caseModule.createCase(ctx(), {
      primaryCustomerId: payerId,
      fundingSources: [],
    });
    caseId = createdCase.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctx = () => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId,
    accessibleWorkshopIds: [workshopId] as string[],
    correlationId: '00000000-0000-0000-0000-0000000d3f99',
  });

  it('createTaskTemplate + listActiveTaskTemplatesForEvent returns the matching template', async () => {
    const tpl = await workforce.createTaskTemplate(ctx(), {
      name: 'Klargjør faktura',
      triggerEventType: 'production.state.transitioned',
      triggerEventFilter: { toStateCode: 'delivered' },
      taskKind: 'invoice_prep',
      taskTitleTemplate: 'Klargjør faktura — {caseNumber}',
      dueOffsetMinutes: 60,
      dueReference: 'event_time',
      defaultPriority: 'high',
    });
    expect(tpl.isActive).toBe(true);

    const matches = await workforce.listActiveTaskTemplatesForEvent(
      ctx(),
      'production.state.transitioned',
    );
    expect(matches.find((t) => t.id === tpl.id)).toBeTruthy();

    // Different event type → no match.
    const noMatch = await workforce.listActiveTaskTemplatesForEvent(
      ctx(),
      'case.booking.confirmed',
    );
    expect(noMatch.find((t) => t.id === tpl.id)).toBeFalsy();
  });

  it('evaluateAndGenerate creates an office task with provenance set', async () => {
    const tpl = await workforce.createTaskTemplate(ctx(), {
      name: 'Bestill deler',
      triggerEventType: 'case.booking.confirmed',
      triggerEventFilter: null,
      taskKind: 'order_parts',
      taskTitleTemplate: 'Bestill deler — {caseNumber}',
      dueOffsetMinutes: -10 * 24 * 60,
      dueReference: 'case_expected_arrival_at',
      defaultPriority: 'normal',
    });

    const eventId = '00000000-0000-0000-0000-0000000d3f10';
    const arrival = new Date('2030-01-15T08:00:00Z');
    const event = {
      eventId,
      organizationId: orgId,
      eventType: 'case.booking.confirmed',
      payload: {
        caseId,
        caseNumber: 'SAK-D3-001',
        expectedArrivalAt: arrival.toISOString(),
        customerName: 'Template Customer',
      },
      occurredAt: new Date(),
    };
    const result = await workforce.evaluateAndGenerate(ctx(), event);
    expect(result.templatesEvaluated).toBeGreaterThanOrEqual(1);
    expect(result.tasksCreated).toBeGreaterThanOrEqual(1);

    const rows = await h.admin`
      SELECT id, title, kind, generated_from_template_id, generated_from_event_id, due_at, case_id
      FROM office_tasks
      WHERE organization_id = ${orgId}
        AND generated_from_template_id = ${tpl.id}
    `;
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row['kind']).toBe('order_parts');
    expect(row['title']).toBe('Bestill deler — SAK-D3-001');
    expect(row['generated_from_event_id']).toBe(eventId);
    expect(row['case_id']).toBe(caseId);

    const dueAt = row['due_at'] as Date;
    const expectedDue = new Date(arrival.getTime() - 10 * 24 * 60 * 60_000);
    expect(Math.abs(dueAt.getTime() - expectedDue.getTime())).toBeLessThan(
      60_000,
    );
  });

  it('replay of the same outbox event is idempotent (unique index absorbs)', async () => {
    await workforce.createTaskTemplate(ctx(), {
      name: 'Ring kunde dagen før',
      triggerEventType: 'case.booking.confirmed.dayBefore',
      triggerEventFilter: null,
      taskKind: 'customer_call',
      taskTitleTemplate: 'Ring kunde',
      dueOffsetMinutes: -24 * 60,
      dueReference: 'case_expected_arrival_at',
    });

    const eventId = '00000000-0000-0000-0000-0000000d3f20';
    const event = {
      eventId,
      organizationId: orgId,
      eventType: 'case.booking.confirmed.dayBefore',
      payload: {
        caseId,
        caseNumber: 'SAK-D3-002',
        expectedArrivalAt: '2030-02-01T08:00:00Z',
      },
      occurredAt: new Date(),
    };
    const first = await workforce.evaluateAndGenerate(ctx(), event);
    const second = await workforce.evaluateAndGenerate(ctx(), event);

    expect(first.tasksCreated).toBe(1);
    expect(second.tasksCreated).toBe(0);
    expect(second.duplicatesSkipped).toBe(1);

    const rows = await h.admin`
      SELECT count(*)::int as n FROM office_tasks
      WHERE organization_id = ${orgId}
        AND generated_from_event_id = ${eventId}
    `;
    expect(rows[0]!['n']).toBe(1);
  });

  it('triggerEventFilter narrows generation (no-match → no task)', async () => {
    const tpl = await workforce.createTaskTemplate(ctx(), {
      name: 'Bestill leiebil',
      triggerEventType: 'case.booking.confirmed.rental',
      triggerEventFilter: { requiresRental: true },
      taskKind: 'rental_booking',
      taskTitleTemplate: 'Bestill leiebil — {caseNumber}',
      dueReference: 'case_expected_arrival_at',
    });

    // Event without `requiresRental: true` → no task generated.
    const skipped = await workforce.evaluateAndGenerate(ctx(), {
      eventId: '00000000-0000-0000-0000-0000000d3f30',
      organizationId: orgId,
      eventType: 'case.booking.confirmed.rental',
      payload: {
        caseId,
        caseNumber: 'SAK-D3-003',
        expectedArrivalAt: '2030-03-01T08:00:00Z',
      },
      occurredAt: new Date(),
    });
    expect(skipped.tasksCreated).toBe(0);

    // Event WITH the flag → task generated.
    const matched = await workforce.evaluateAndGenerate(ctx(), {
      eventId: '00000000-0000-0000-0000-0000000d3f31',
      organizationId: orgId,
      eventType: 'case.booking.confirmed.rental',
      payload: {
        caseId,
        caseNumber: 'SAK-D3-004',
        expectedArrivalAt: '2030-04-01T08:00:00Z',
        requiresRental: true,
      },
      occurredAt: new Date(),
    });
    expect(matched.tasksCreated).toBe(1);

    const rows = await h.admin`
      SELECT count(*)::int as n FROM office_tasks
      WHERE organization_id = ${orgId}
        AND generated_from_template_id = ${tpl.id}
    `;
    expect(rows[0]!['n']).toBe(1);
  });
});
