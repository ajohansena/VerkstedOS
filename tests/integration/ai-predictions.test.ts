import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * AI predictions projection + feature-flag gating (Sprint 21). Validates:
 * a flag-OFF call returns null (no row inserted); a flag-ON call against a
 * registered model inserts a row carrying inputs/output/rationale; an
 * unregistered model raises; a retired model raises.
 */
describe('AI predictions projection + flag gating', () => {
  let h: IsolationHarness;
  let ai: typeof import('@/modules/ai/public');
  let identity: typeof import('@/modules/identity/public');
  let platform: typeof import('@/modules/platform/public');

  let orgId: string;
  let userId: string;
  const platformUserId = '00000000-0000-0000-0000-0000000021b0';

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    ai = await import('@/modules/ai/public');
    identity = await import('@/modules/identity/public');
    platform = await import('@/modules/platform/public');

    userId = '00000000-0000-0000-0000-0000000021b1';
    await identity.ensureUser({
      id: userId,
      email: 'ai-user@example.no',
      fullName: 'Ada AI',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'AI Test Org',
      ownerUserId: userId,
    });
    orgId = organization.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx(): import('@/lib/tenancy/context').RequestContext {
    return {
      organizationId: orgId,
      workshopId: null,
      userId,
      correlationId: '00000000-0000-0000-0000-0000000021c1',
      roles: [],
      permissions: new Set([
        'case:view',
        'case:edit',
      ]) as unknown as ReadonlySet<never>,
    } as unknown as import('@/lib/tenancy/context').RequestContext;
  }

  const platformCtx = {
    platformUserId,
    userId: platformUserId,
    roles: [],
    permissions: new Set<never>(),
  } as unknown as import('@/lib/platform/auth').PlatformContext;

  it('returns null when the feature flag is OFF', async () => {
    // Register a model so the only failure path is the flag check.
    await ai.registerAiModelVersion(platformCtx, {
      key: 'delay_risk',
      version: 'flag-test',
      provider: 'internal',
      status: 'active',
    });
    const result = await ai.recordPrediction(ctx(), {
      featureKey: ai.AI_FEATURE_KEYS.delayRisk,
      modelKey: 'delay_risk',
      modelVersion: 'flag-test',
      kind: 'delay_risk',
      subjectType: 'case',
      subjectId: '00000000-0000-0000-0000-0000000000aa',
      inputs: { caseId: '00000000-0000-0000-0000-0000000000aa' },
      output: { risk: 'high' },
    });
    expect(result).toBeNull();
  });

  it('inserts a prediction row when the flag is ON and the model is registered', async () => {
    await platform.setFeatureFlag({
      key: ai.AI_FEATURE_KEYS.delayRisk,
      organizationId: orgId,
      enabled: true,
      description: 'AI delay risk for ai-test org',
      platformUserId,
    });
    await ai.registerAiModelVersion(platformCtx, {
      key: 'delay_risk',
      version: 'on-test',
      provider: 'internal',
      status: 'active',
    });
    const subjectId = '00000000-0000-0000-0000-0000000000bb';
    const result = await ai.recordPrediction(ctx(), {
      featureKey: ai.AI_FEATURE_KEYS.delayRisk,
      modelKey: 'delay_risk',
      modelVersion: 'on-test',
      kind: 'delay_risk',
      subjectType: 'case',
      subjectId,
      inputs: { caseId: subjectId, openedDaysAgo: 14 },
      output: { risk: 'medium', score: 0.62 },
      rationale: 'Case has been open for 14 days; median is 9.',
      confidence: 0.62,
      latencyMs: 42,
      costMicroUsd: 120,
    });
    expect(result).not.toBeNull();
    expect(result?.modelKey).toBe('delay_risk');
    expect(result?.modelVersion).toBe('on-test');
    expect(result?.rationale).toMatch(/14 days/);
    expect(result?.confidence).toBe('0.6200');

    const subjectPredictions = await ai.listPredictionsForSubject(
      ctx(),
      'case',
      subjectId,
    );
    expect(subjectPredictions).toHaveLength(1);
  });

  it('raises when the model is not registered', async () => {
    await platform.setFeatureFlag({
      key: ai.AI_FEATURE_KEYS.etaEstimate,
      organizationId: orgId,
      enabled: true,
      platformUserId,
    });
    await expect(
      ai.recordPrediction(ctx(), {
        featureKey: ai.AI_FEATURE_KEYS.etaEstimate,
        modelKey: 'eta_estimate',
        modelVersion: 'missing',
        kind: 'eta_estimate',
        subjectType: 'case',
        subjectId: '00000000-0000-0000-0000-0000000000cc',
        inputs: {},
        output: {},
      }),
    ).rejects.toThrow(/not registered/);
  });

  it('raises when the model is retired', async () => {
    const model = await ai.registerAiModelVersion(platformCtx, {
      key: 'parts_suggestion',
      version: 'retired-test',
      provider: 'internal',
      status: 'active',
    });
    await ai.changeAiModelStatus(platformCtx, {
      id: model.id,
      status: 'retired',
    });
    await platform.setFeatureFlag({
      key: ai.AI_FEATURE_KEYS.partsSuggestion,
      organizationId: orgId,
      enabled: true,
      platformUserId,
    });
    await expect(
      ai.recordPrediction(ctx(), {
        featureKey: ai.AI_FEATURE_KEYS.partsSuggestion,
        modelKey: 'parts_suggestion',
        modelVersion: 'retired-test',
        kind: 'parts_suggestion',
        subjectType: 'case',
        subjectId: '00000000-0000-0000-0000-0000000000dd',
        inputs: {},
        output: {},
      }),
    ).rejects.toThrow(/retired/);
  });
});
