import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Audit + outbox integration suite (Sprint 4).
 *
 * Proves, against real Postgres (migrations incl. partitioned audit + RLS):
 *   1. A full-audited mutation writes an immutable audit_events row in the SAME
 *      transaction, and an outbox_events row — atomically.
 *   2. audit_events is append-only: UPDATE/DELETE are rejected by RLS for the
 *      non-superuser app role (no such policies exist).
 *   3. The outbox publisher core ships pending rows and marks them published;
 *      a failing sender records the error and keeps the row for retry.
 *
 * Admin/bootstrap writes use the superuser connection (DATABASE_URL_ADMIN);
 * tenant operations use the non-superuser app role (DATABASE_URL).
 */
describe('audit + outbox', () => {
  let h: IsolationHarness;
  let identity: typeof import('@/modules/identity/public');
  let publisher: typeof import('@/lib/events/publisher');

  let orgId: string;
  let ownerUserId: string;
  let techMembershipId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    identity = await import('@/modules/identity/public');
    publisher = await import('@/lib/events/publisher');

    ownerUserId = '00000000-0000-0000-0000-0000000000c1';
    const techUserId = '00000000-0000-0000-0000-0000000000c2';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner4@example.no',
      fullName: 'Olav Owner',
    });
    await identity.ensureUser({
      id: techUserId,
      email: 'tech4@example.no',
      fullName: 'Tina Tech',
    });

    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Audit Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const [techRole] = await h.admin`
      SELECT id FROM roles WHERE organization_id = ${orgId} AND key = 'technician'
    `;
    const { membershipId } = await identity.addMembershipWithRole({
      organizationId: orgId,
      userId: techUserId,
      roleId: techRole!['id'] as string,
      assignedByUserId: ownerUserId,
    });
    techMembershipId = membershipId;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ownerCtx = () => ({
    userId: ownerUserId,
    organizationId: orgId,
    workshopId: null,
    accessibleWorkshopIds: [] as string[],
    correlationId: '00000000-0000-0000-0000-0000000000cf',
  });

  it('grantPermission writes an audit row and an outbox event atomically', async () => {
    await identity.grantPermission(ownerCtx(), {
      membershipId: techMembershipId,
      permissionCode: 'finance:view',
      kind: 'grant',
      reason: 'Audit test grant',
    });

    const audit = await h.admin`
      SELECT action, reason, entity_table FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'user_permission_grants'
    `;
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(audit[0]!['reason']).toBe('Audit test grant');

    const outbox = await h.admin`
      SELECT event_type, status FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'identity.permission_grant.created'
    `;
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    expect(outbox[0]!['status']).toBe('pending');
  });

  it('assignRole emits identity.role_assignment.granted to the outbox', async () => {
    const [estimatorRole] = await h.admin`
      SELECT id FROM roles WHERE organization_id = ${orgId} AND key = 'estimator'
    `;
    await identity.assignRole(ownerCtx(), {
      membershipId: techMembershipId,
      roleId: estimatorRole!['id'] as string,
    });

    const outbox = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'identity.role_assignment.granted'
    `;
    expect(outbox.length).toBeGreaterThanOrEqual(1);
  });

  it('audit_events is append-only: UPDATE and DELETE affect zero rows for the app role', async () => {
    // With no UPDATE/DELETE policy, RLS silently filters all rows out of the
    // command (zero rows affected) rather than erroring. Append-only is proven
    // by the row surviving unchanged.
    const before = await h.admin`
      SELECT id, reason FROM audit_events
      WHERE organization_id = ${orgId} AND entity_table = 'user_permission_grants'
      ORDER BY occurred_at ASC LIMIT 1
    `;
    const targetId = before[0]!['id'] as string;
    const originalReason = before[0]!['reason'] as string;

    const updated = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`UPDATE audit_events SET reason = 'tampered' WHERE organization_id = ${orgId}`;
    });
    expect(updated.count).toBe(0);

    const deleted = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`DELETE FROM audit_events WHERE organization_id = ${orgId}`;
    });
    expect(deleted.count).toBe(0);

    // The original row is still present and unchanged.
    const after = await h.admin`
      SELECT reason FROM audit_events WHERE id = ${targetId}
    `;
    expect(after).toHaveLength(1);
    expect(after[0]!['reason']).toBe(originalReason);
  });

  it('publisher ships pending events and marks them published', async () => {
    const sent: string[] = [];
    const result = await publisher.publishPendingOutbox(async (event) => {
      sent.push(event.eventType);
    });

    expect(result.published).toBeGreaterThanOrEqual(2);
    expect(sent).toContain('identity.role_assignment.granted');

    const stillPending = await h.admin`
      SELECT count(*)::int AS n FROM outbox_events
      WHERE organization_id = ${orgId} AND status = 'pending'
    `;
    expect(stillPending[0]!['n']).toBe(0);
  });

  it('a failing sender keeps the row pending and records the error', async () => {
    // Emit a fresh event by granting another permission.
    await identity.grantPermission(ownerCtx(), {
      membershipId: techMembershipId,
      permissionCode: 'parts:view',
      kind: 'grant',
      reason: 'retry test',
    });

    const result = await publisher.publishPendingOutbox(async () => {
      throw new Error('downstream unavailable');
    });
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const row = await h.admin`
      SELECT attempts, last_error, status FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'identity.permission_grant.created'
      ORDER BY occurred_at DESC LIMIT 1
    `;
    expect(row[0]!['attempts']).toBeGreaterThanOrEqual(1);
    expect(row[0]!['last_error']).toContain('downstream unavailable');
    expect(row[0]!['status']).toBe('pending');
  });
});
