import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * RBAC integration suite (Sprint 3).
 *
 * Validates the full chain against real Postgres: migrations (incl. the
 * has_permission function + cache triggers in 0003), org onboarding, role
 * assignment, scope-aware resolution, deny-wins, the effective-permissions
 * cache, and the coarse RLS permission function.
 *
 * Admin/bootstrap writes use the superuser connection (DATABASE_URL_ADMIN);
 * tenant reads use the non-superuser app role (DATABASE_URL) so RLS is real.
 */
describe('RBAC', () => {
  let h: IsolationHarness;
  // Loaded after env is pointed at the harness connections.
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let techUserId: string;
  let techMembershipId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();

    // Tenant path → non-superuser app role; admin path → superuser (bypasses RLS).
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    identity = await import('@/modules/identity/public');

    // Two auth users.
    ownerUserId = '00000000-0000-0000-0000-0000000000a1';
    techUserId = '00000000-0000-0000-0000-0000000000a2';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner@example.no',
      fullName: 'Olav Owner',
    });
    await identity.ensureUser({
      id: techUserId,
      email: 'tech@example.no',
      fullName: 'Tina Tech',
    });

    // Bootstrap org with owner (seeds 6 roles, owner membership + assignment).
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Carlsen Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    // Add the technician with the Technician role.
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

  const ctxFor = (userId: string) => ({
    userId,
    organizationId: orgId,
    workshopId: null,
    accessibleWorkshopIds: [] as string[],
    correlationId: '00000000-0000-0000-0000-0000000000ff',
  });

  it('seeds exactly the six standard roles', async () => {
    const rows = await h.admin`
      SELECT key FROM roles WHERE organization_id = ${orgId} ORDER BY key
    `;
    expect(rows.map((r) => r['key'])).toEqual([
      'accounting',
      'admin',
      'estimator',
      'owner',
      'technician',
      'viewer',
    ]);
  });

  it('owner can do everything (finance:export)', async () => {
    const allowed = await identity.hasPermission(
      ctxFor(ownerUserId),
      'finance:export',
    );
    expect(allowed).toBe(true);
  });

  it('technician can clock in (time:self) but cannot view finance', async () => {
    const ctx = ctxFor(techUserId);
    expect(await identity.hasPermission(ctx, 'time:self')).toBe(true);
    expect(await identity.hasPermission(ctx, 'production:transition')).toBe(
      true,
    );
    expect(await identity.hasPermission(ctx, 'finance:view')).toBe(false);
    expect(await identity.hasPermission(ctx, 'admin:users')).toBe(false);
  });

  it('requirePermission throws PermissionDeniedError when missing', async () => {
    await expect(
      identity.requirePermission(ctxFor(techUserId), 'finance:export'),
    ).rejects.toBeInstanceOf(identity.PermissionDeniedError);
  });

  it('effective-permissions cache reflects the technician bundle', async () => {
    const codes = await identity.getEffectivePermissionCodes(
      ctxFor(techUserId),
      techUserId,
    );
    expect(codes).toContain('time:self');
    expect(codes).toContain('production:transition');
    expect(codes).not.toContain('finance:view');
  });

  it('coarse RLS function app_has_permission matches', async () => {
    const result = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      await tx`select set_config('app.current_user_id', ${techUserId}, true)`;
      const yes = await tx`SELECT app_has_permission('time:self') AS ok`;
      const no = await tx`SELECT app_has_permission('finance:export') AS ok`;
      return { yes: yes[0]!['ok'], no: no[0]!['ok'] };
    });
    expect(result.yes).toBe(true);
    expect(result.no).toBe(false);
  });

  it('deny wins: a deny override removes a role-granted permission', async () => {
    const ctx = ctxFor(techUserId);
    expect(await identity.hasPermission(ctx, 'time:self')).toBe(true);

    await identity.grantPermission(ctxFor(ownerUserId), {
      membershipId: techMembershipId,
      permissionCode: 'time:self',
      kind: 'deny',
      reason: 'Suspended pending review',
    });

    expect(await identity.hasPermission(ctx, 'time:self')).toBe(false);
  });

  it('grant override adds a permission outside the role', async () => {
    const ctx = ctxFor(techUserId);
    expect(await identity.hasPermission(ctx, 'finance:view')).toBe(false);

    await identity.grantPermission(ctxFor(ownerUserId), {
      membershipId: techMembershipId,
      permissionCode: 'finance:view',
      kind: 'grant',
      reason: 'Temporary stand-in for accounting',
    });

    expect(await identity.hasPermission(ctx, 'finance:view')).toBe(true);
  });

  it('a permission check requires a valid membership in the org', async () => {
    const strangerCtx = {
      ...ctxFor('00000000-0000-0000-0000-0000000000b9'),
    };
    expect(await identity.hasPermission(strangerCtx, 'case:view')).toBe(false);
  });
});
