import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Digital signatures integration suite (Sprint 12). Validates the tamper-
 * evident cryptographic chain against real Postgres: appended links chain to
 * each other, the chain verifies, and a manual mutation of an earlier row is
 * DETECTED by re-verification. Append-only RLS is also exercised.
 */
describe('digital signatures', () => {
  let h: IsolationHarness;
  let quality: typeof import('@/modules/quality/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    quality = await import('@/modules/quality/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b5';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner12s@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Signatur Bilskade',
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
      correlationId: '00000000-0000-0000-0000-0000000000f5',
    };
  }

  it('appends a chained signature and verifies the chain', async () => {
    const first = await quality.appendSignature(ctx(), {
      caseId,
      kind: 'repair_acceptance',
      signerName: 'Ola Hansen',
      payload: JSON.stringify({ decision: 'accepted' }),
    });
    expect(first.sequenceNo).toBe(0);
    expect(first.previousChainHash).toBeNull();
    expect(first.chainHash).toMatch(/^[0-9a-f]{64}$/);

    const second = await quality.appendSignature(ctx(), {
      caseId,
      kind: 'delivery_handover',
      signerName: 'Ola Hansen',
      payload: JSON.stringify({ handover: true }),
    });
    expect(second.sequenceNo).toBe(1);
    expect(second.previousChainHash).toBe(first.chainHash);

    const result = await quality.verifyCaseChain(ctx(), caseId);
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'quality.signature.appended'
    `;
    expect(event.length).toBeGreaterThanOrEqual(2);
  });

  it('detects tampering when an earlier row is mutated (admin)', async () => {
    // Tamper directly via the superuser connection (bypasses append-only RLS),
    // simulating a database-level attack. Re-verification must catch it.
    await h.admin`
      UPDATE digital_signatures SET payload_hash = 'deadbeef'
      WHERE organization_id = ${orgId} AND case_id = ${caseId} AND sequence_no = 0
    `;
    const result = await quality.verifyCaseChain(ctx(), caseId);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('is append-only for the app role (no UPDATE policy)', async () => {
    const updated = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`UPDATE digital_signatures SET signer_name = 'x' WHERE organization_id = ${orgId}`;
    });
    expect(updated.count).toBe(0);
  });
});
