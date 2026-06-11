import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Resource auto-materialisation (Sprint 22 Phase B).
 *
 * Validates that `createEmployee` automatically creates a `person` Resource in
 * the SAME transaction (doc 10 § Resource model). The opt-out flag
 * `excludeFromPlanning` suppresses creation for HR-only roles.
 *
 * Also covers the explicit `createResource` admin path for equipment +
 * facilities, plus `archiveResource` soft-delete and `updateResource`.
 */
describe('resource management', () => {
  let h: IsolationHarness;
  let workforce: typeof import('@/modules/workforce/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    workforce = await import('@/modules/workforce/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner-resources@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Resource Bilskade',
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
      correlationId: '00000000-0000-0000-0000-0000000000fc',
    };
  }

  it('auto-creates a person Resource when an Employee is created', async () => {
    const employee = await workforce.createEmployee(ctx(), {
      fullName: 'Erik Tekniker',
      skills: [{ skillCode: 'paint', proficiency: 'qualified' }],
    });

    const all = await workforce.listResources(ctx());
    const linked = all.find((r) => r.employeeId === employee.id);
    expect(linked).toBeDefined();
    expect(linked?.kind).toBe('person');
    expect(linked?.name).toBe('Erik Tekniker');
    expect(linked?.status).toBe('active');

    const events = await h.admin`
      SELECT event_type, payload FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'workforce.resource.created'
    `;
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('opt-out (excludeFromPlanning) skips Resource creation', async () => {
    const before = (await workforce.listResources(ctx())).length;
    const employee = await workforce.createEmployee(ctx(), {
      fullName: 'Ada Administrator',
      excludeFromPlanning: true,
    });
    const after = await workforce.listResources(ctx());
    expect(after.length).toBe(before);
    expect(after.find((r) => r.employeeId === employee.id)).toBeUndefined();
  });

  it('creates an equipment Resource via createResource', async () => {
    const resource = await workforce.createResource(ctx(), {
      kind: 'equipment',
      name: 'Paint booth 1',
      metadata: { equipmentKind: 'paint_booth' },
    });
    expect(resource.kind).toBe('equipment');
    expect(resource.employeeId).toBeNull();

    const fetched = await workforce.findResourceById(ctx(), resource.id);
    expect(fetched?.id).toBe(resource.id);
  });

  it('updates and archives a Resource', async () => {
    const resource = await workforce.createResource(ctx(), {
      kind: 'facility',
      name: 'Frame bench A',
    });
    const updated = await workforce.updateResource(ctx(), resource.id, {
      name: 'Frame bench A (renamed)',
      status: 'maintenance',
    });
    expect(updated?.name).toBe('Frame bench A (renamed)');
    expect(updated?.status).toBe('maintenance');

    const archived = await workforce.archiveResource(ctx(), resource.id);
    expect(archived?.deletedAt).not.toBeNull();

    const all = await workforce.listResources(ctx());
    expect(all.find((r) => r.id === resource.id)).toBeUndefined();
  });
});
