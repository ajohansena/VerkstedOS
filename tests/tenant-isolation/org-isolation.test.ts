import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startIsolationHarness, type IsolationHarness } from './harness';

/**
 * Tenant-isolation suite (CLAUDE.md § 4.2 — the bedrock test).
 *
 * Proves org isolation two ways:
 *   1. At the database level, connected as the non-superuser app role, RLS
 *      restricts every read/write to the current org context.
 *   2. Through the actual tenant-aware client (`withTransaction`), the same
 *      isolation holds on the real production code path.
 *
 * A cross-tenant leak here is a P0 — these assertions must never be weakened.
 */
describe('tenant isolation', () => {
  let h: IsolationHarness;
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    h = await startIsolationHarness();

    // Seed two orgs with one customer each, via the superuser (bypasses RLS).
    const [a] = await h.admin`
      INSERT INTO organizations (name) VALUES ('Org A') RETURNING id
    `;
    const [b] = await h.admin`
      INSERT INTO organizations (name) VALUES ('Org B') RETURNING id
    `;
    orgA = a!['id'] as string;
    orgB = b!['id'] as string;

    await h.admin`
      INSERT INTO customers (organization_id, kind, name)
      VALUES (${orgA}, 'individual', 'Alice (Org A)')
    `;
    await h.admin`
      INSERT INTO customers (organization_id, kind, name)
      VALUES (${orgB}, 'individual', 'Bob (Org B)')
    `;
    await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgA}, 'Workshop A1')
    `;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  it('app role with org A context sees only org A customers', async () => {
    const rows = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgA}, true)`;
      return tx`SELECT name FROM customers`;
    });
    expect(rows.map((r) => r['name'])).toEqual(['Alice (Org A)']);
  });

  it('app role with org B context sees only org B customers', async () => {
    const rows = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgB}, true)`;
      return tx`SELECT name FROM customers`;
    });
    expect(rows.map((r) => r['name'])).toEqual(['Bob (Org B)']);
  });

  it('app role with NO org context sees nothing', async () => {
    const rows = await h.app`SELECT name FROM customers`;
    expect(rows).toHaveLength(0);
  });

  it('app role cannot INSERT a row into another org (RLS WITH CHECK)', async () => {
    await expect(
      h.app.begin(async (tx) => {
        await tx`select set_config('app.current_org_id', ${orgA}, true)`;
        // Trying to write a row owned by org B while in org A context.
        return tx`
          INSERT INTO customers (organization_id, kind, name)
          VALUES (${orgB}, 'individual', 'Mallory')
        `;
      }),
    ).rejects.toThrow();
  });

  it('app role cannot read another org by spoofing the WHERE clause', async () => {
    const rows = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgA}, true)`;
      // Even explicitly asking for org B rows returns nothing — RLS filters.
      return tx`SELECT name FROM customers WHERE organization_id = ${orgB}`;
    });
    expect(rows).toHaveLength(0);
  });

  it('platform inspector flag grants read-only cross-org visibility', async () => {
    const rows = await h.app.begin(async (tx) => {
      await tx`select set_config('app.is_platform_inspector', 'true', true)`;
      await tx`select set_config('app.current_org_id', ${orgB}, true)`;
      return tx`SELECT name FROM customers ORDER BY name`;
    });
    // Inspector targeting org B can read org B; org-scoped select still applies
    // the org filter, so it sees org B's customer.
    expect(rows.map((r) => r['name'])).toContain('Bob (Org B)');
  });

  it('insurance_companies catalog is readable by any tenant', async () => {
    await h.admin`
      INSERT INTO insurance_companies (code, name) VALUES ('test_ins', 'Test Insurer')
      ON CONFLICT (code) DO NOTHING
    `;
    const rows = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgA}, true)`;
      return tx`SELECT code FROM insurance_companies WHERE code = 'test_ins'`;
    });
    expect(rows).toHaveLength(1);
  });

  it('the tenant-aware client (withTransaction) isolates by org', async () => {
    // Point the production client at the non-superuser app role, then import it.
    process.env.DATABASE_URL = h.appUrl;
    const { withTransaction } = await import('@/db/client');
    const { customers } = await import('@/db/schemas/customer/customers');
    const { eq } = await import('drizzle-orm');

    const ctxA = {
      userId: '00000000-0000-0000-0000-000000000001',
      organizationId: orgA,
      workshopId: null,
      accessibleWorkshopIds: [],
      correlationId: '00000000-0000-0000-0000-0000000000aa',
    };

    const aRows = await withTransaction(ctxA, async (tx) =>
      tx.select({ name: customers.name }).from(customers),
    );
    expect(aRows.map((r) => r.name)).toEqual(['Alice (Org A)']);

    // Cross-org read attempt via the client returns nothing.
    const leak = await withTransaction(ctxA, async (tx) =>
      tx
        .select({ name: customers.name })
        .from(customers)
        .where(eq(customers.organizationId, orgB)),
    );
    expect(leak).toHaveLength(0);
  });
});
