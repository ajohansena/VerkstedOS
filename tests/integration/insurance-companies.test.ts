import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Insurance-company catalog reader (D1 — Intake Wizard).
 *
 * `insurance_companies` is a PLATFORM-SHARED, READ-ONLY catalog (no
 * `organization_id`). The intake wizard reads it to populate the funding-step
 * insurer picker when the user chooses `insurance` as a funding kind.
 *
 * Validates that:
 *   - the reader returns active companies (deactivated rows hidden)
 *   - results are sorted by name (UI consumes them directly)
 *   - the same catalog is visible from two different tenants
 */
describe('listInsuranceCompanies', () => {
  let h: IsolationHarness;
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgA: string;
  let orgB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    userA = '00000000-0000-0000-0000-00000000aaa1';
    userB = '00000000-0000-0000-0000-00000000bbb1';
    await identity.ensureUser({
      id: userA,
      email: 'a-insurer@example.no',
      fullName: 'Anders A',
    });
    await identity.ensureUser({
      id: userB,
      email: 'b-insurer@example.no',
      fullName: 'Berit B',
    });
    const a = await identity.createOrganizationWithOwner({
      name: 'A AS',
      ownerUserId: userA,
    });
    const b = await identity.createOrganizationWithOwner({
      name: 'B AS',
      ownerUserId: userB,
    });
    orgA = a.organization.id;
    orgB = b.organization.id;

    // Seed two insurers — one active, one inactive — to verify filtering.
    await h.admin`
      INSERT INTO insurance_companies (code, name, is_active)
      VALUES
        ('test-fremtind', 'Fremtind Test', true),
        ('test-deactivated', 'Deactivated Insurer', false)
      ON CONFLICT (code) DO NOTHING
    `;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const ctxFor = (orgId: string, userId: string) => ({
    userId,
    organizationId: orgId,
    accessibleWorkshopIds: [] as string[],
    correlationId: '00000000-0000-0000-0000-0000000000ee',
  });

  it('returns only active insurance companies, sorted by name', async () => {
    const list = await caseModule.listInsuranceCompanies(ctxFor(orgA, userA));
    expect(list.length).toBeGreaterThan(0);
    // None of the returned rows are deactivated.
    expect(list.every((r) => r.isActive)).toBe(true);
    // The deactivated test row is NOT present.
    expect(list.find((r) => r.code === 'test-deactivated')).toBeUndefined();
    // Sorted alphabetically by name.
    const names = list.map((r) => r.name);
    const sorted = [...names].sort((x, y) => x.localeCompare(y));
    expect(names).toEqual(sorted);
  });

  it('returns the same catalog to two different tenants (platform-shared)', async () => {
    const listA = await caseModule.listInsuranceCompanies(ctxFor(orgA, userA));
    const listB = await caseModule.listInsuranceCompanies(ctxFor(orgB, userB));
    expect(listA.map((r) => r.code).sort()).toEqual(
      listB.map((r) => r.code).sort(),
    );
  });
});
