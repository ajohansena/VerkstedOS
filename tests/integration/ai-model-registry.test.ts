import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * AI model registry (Sprint 21). Validates: registering a new model version
 * succeeds; the same (key, version) pair cannot be registered twice; status
 * transitions through active → shadow → retired are reflected on read.
 */
describe('AI model registry', () => {
  let h: IsolationHarness;
  let ai: typeof import('@/modules/ai/public');

  const platformUserId = '00000000-0000-0000-0000-0000000021a0';

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    ai = await import('@/modules/ai/public');
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  const platformCtx = {
    platformUserId,
    userId: platformUserId,
    roles: [],
    permissions: new Set<never>(),
  } as unknown as import('@/lib/platform/auth').PlatformContext;

  it('registers a new model version and lists it', async () => {
    const row = await ai.registerAiModelVersion(platformCtx, {
      key: 'delay_risk',
      version: '1.0.0',
      provider: 'internal',
      description: 'Baseline delay risk classifier',
    });
    expect(row.key).toBe('delay_risk');
    expect(row.version).toBe('1.0.0');
    expect(row.status).toBe('shadow');

    const models = await ai.listModels();
    expect(models.some((m) => m.id === row.id)).toBe(true);
  });

  it('rejects duplicate (key, version) registration', async () => {
    await ai.registerAiModelVersion(platformCtx, {
      key: 'eta_estimate',
      version: '1.0.0',
      provider: 'internal',
    });
    await expect(
      ai.registerAiModelVersion(platformCtx, {
        key: 'eta_estimate',
        version: '1.0.0',
        provider: 'internal',
      }),
    ).rejects.toThrow(/already registered/);
  });

  it('changes status from shadow to active and then to retired', async () => {
    const row = await ai.registerAiModelVersion(platformCtx, {
      key: 'parts_suggestion',
      version: '0.1.0',
      provider: 'internal',
    });
    const active = await ai.changeAiModelStatus(platformCtx, {
      id: row.id,
      status: 'active',
    });
    expect(active.status).toBe('active');
    const retired = await ai.changeAiModelStatus(platformCtx, {
      id: row.id,
      status: 'retired',
    });
    expect(retired.status).toBe('retired');
  });
});
