import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Notifications engine integration suite (Sprint 17).
 *
 * Validates the parts_delay rule end-to-end against real Postgres: the seed
 * notification rules exist for a new org, the engine fires when a part
 * requirement has been flagged past the threshold, re-running is idempotent
 * (UPSERT not INSERT), and an admin can disable the rule.
 */
describe('notifications engine', () => {
  let h: IsolationHarness;
  let notifications: typeof import('@/modules/notifications/public');
  let parts: typeof import('@/modules/parts/public');
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
    parts = await import('@/modules/parts/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');
    const seed = await import('@/lib/seed/notification-rules');

    ownerUserId = '00000000-0000-0000-0000-0000000017a1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner17@example.no',
      fullName: 'Nora Notify',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Notify Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Notify Oslo') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

    await seed.seedNotificationRules(orgId);

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
      correlationId: '00000000-0000-0000-0000-000000001701',
    };
  }

  it('seeds the default rules for the org', async () => {
    const rules = await notifications.listOrgNotificationRules(ctx());
    const codes = rules.map((r) => r.code).sort();
    expect(codes).toEqual(
      ['delivery_at_risk', 'parts_delay', 'supplement_pending'].sort(),
    );
    for (const r of rules) expect(r.enabled).toBe(true);
  });

  it('fires parts_delay when a part has been flagged past the threshold', async () => {
    const requirement = await parts.flagPartRequirement(ctx(), {
      caseId,
      description: 'Frontskjerm',
      partNumber: 'CIT-9000',
      quantity: 1,
    });

    // Backdate the requirement so it appears older than the 3-day threshold.
    await h.admin`
      UPDATE part_requirements
         SET created_at = now() - interval '5 days'
       WHERE id = ${requirement.id}
    `;

    const result = await notifications.evaluateNotificationRules(ctx());
    expect(result.fired).toBeGreaterThanOrEqual(1);
    expect(result.perRule['parts_delay']).toBeGreaterThanOrEqual(1);

    const inbox = await notifications.listMyNotifications(ctx(), {
      limit: 50,
    });
    const partsHit = inbox.find(
      (n) =>
        n.ruleCode === 'parts_delay' && n.refId === requirement.id,
    );
    expect(partsHit).toBeDefined();
    expect(partsHit?.severity).toBe('warning');
  });

  it('re-running the engine is idempotent (UPSERT, no duplicate row)', async () => {
    const before = await notifications.listMyNotifications(ctx(), {
      limit: 100,
    });
    const beforeCount = before.filter((n) => n.ruleCode === 'parts_delay').length;

    await notifications.evaluateNotificationRules(ctx());

    const after = await notifications.listMyNotifications(ctx(), {
      limit: 100,
    });
    const afterCount = after.filter((n) => n.ruleCode === 'parts_delay').length;

    expect(afterCount).toBe(beforeCount);
  });

  it('does not fire once the requirement progresses', async () => {
    // Move the requirement out of `needed` — engine should no longer fire.
    await h.admin`
      UPDATE part_requirements
         SET status = 'ordered'
       WHERE case_id = ${caseId}
    `;
    const result = await notifications.evaluateNotificationRules(ctx());
    expect(result.perRule['parts_delay'] ?? 0).toBe(0);
  });

  it('disabling a rule prevents it from firing', async () => {
    // Re-set status so the only thing preventing fire is the disabled flag.
    await h.admin`
      UPDATE part_requirements
         SET status = 'needed', created_at = now() - interval '5 days'
       WHERE case_id = ${caseId}
    `;
    await notifications.setOrgNotificationRuleEnabled(
      ctx(),
      'parts_delay',
      false,
    );
    const result = await notifications.evaluateNotificationRules(ctx());
    expect(result.perRule['parts_delay'] ?? 0).toBe(0);
  });
});
