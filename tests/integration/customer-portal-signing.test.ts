import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Customer portal e-signing integration suite (Sprint 20).
 *
 * Validates: the portal token can be exchanged for a tamper-evident
 * digital signature on the case's signature chain. The signature carries
 * `kind=repair_acceptance`, `signer_kind=customer`, and a chain hash. A
 * second submit against an already-signed case is a no-op (idempotent).
 * Expired and revoked tokens cannot sign.
 */
describe('customer portal signing', () => {
  let h: IsolationHarness;
  let notifications: typeof import('@/modules/notifications/public');
  let quality: typeof import('@/modules/quality/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    notifications = await import('@/modules/notifications/public');
    quality = await import('@/modules/quality/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000020d1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'sign20@example.no',
      fullName: 'Sigrid Signer',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Sign Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Sign Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

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
      workshopId,
      accessibleWorkshopIds: [workshopId],
      correlationId: '00000000-0000-0000-0000-0000000020fa',
    };
  }

  it('records a tamper-evident signature when the token is valid', async () => {
    const issued = await notifications.issuePortalToken(ctx(), {
      caseId,
      scope: 'case_acceptance',
      sentTo: 'kunde@example.no',
      ttlDays: 7,
    });

    const result = await notifications.signRepairAcceptanceByToken({
      token: issued.token,
      signerName: 'Ola Nordmann',
      evidence: { ip: '127.0.0.1', userAgent: 'vitest' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.signature.kind).toBe('repair_acceptance');
    expect(result.signature.signerKind).toBe('customer');
    expect(result.signature.signerName).toBe('Ola Nordmann');
    expect(result.signature.chainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signature.sequenceNo).toBe(0);
    expect(result.signature.previousChainHash).toBeNull();
  });

  it('refuses to double-sign an already-signed case', async () => {
    // The previous test signed the case already.
    const issued = await notifications.issuePortalToken(ctx(), {
      caseId,
      scope: 'case_acceptance',
      sentTo: 'kunde@example.no',
      ttlDays: 7,
    });

    const result = await notifications.signRepairAcceptanceByToken({
      token: issued.token,
      signerName: 'Ola Nordmann',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('already_signed');
  });

  it('rejects an unknown / revoked token', async () => {
    const bogus = await notifications.signRepairAcceptanceByToken({
      token: 'this-token-does-not-exist',
      signerName: 'Ola',
    });
    expect(bogus.ok).toBe(false);
    if (bogus.ok) return;
    expect(bogus.reason).toBe('token_invalid');

    // Issue + revoke + try.
    const otherCase = await caseModule.createCase(ctx(), {
      fundingSources: [],
    });
    const t = await notifications.issuePortalToken(ctx(), {
      caseId: otherCase.id,
      scope: 'case_acceptance',
      sentTo: 'kunde2@example.no',
      ttlDays: 7,
    });
    await notifications.revokePortalTokenById(ctx(), t.id);
    const revoked = await notifications.signRepairAcceptanceByToken({
      token: t.token,
      signerName: 'Ola',
    });
    expect(revoked.ok).toBe(false);
    if (revoked.ok) return;
    expect(revoked.reason).toBe('token_revoked');
  });

  it('verifies the chain reads back correctly', async () => {
    const chain = await quality.verifyCaseChainAdmin(orgId, caseId);
    expect(chain.valid).toBe(true);
    expect(chain.brokenAt).toBeNull();
  });
});
