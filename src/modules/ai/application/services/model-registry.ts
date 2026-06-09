/**
 * AI model registry admin service (Sprint 21). Thin wrapper around the
 * platform repository — used by the Dev plane to register and toggle model
 * versions. Every transition is recorded as a PLATFORM audit event (the
 * tier introduced in Sprint 17 for cross-org / no-org actions).
 */

import { recordPlatformAudit } from '@/lib/platform/audit';
import type { PlatformContext } from '@/lib/platform/auth';

import {
  insertAiModelVersion,
  setAiModelStatus,
  listAiModelVersions,
  getAiModelVersionByKeyVersion,
  type AiModelProvider,
  type AiModelStatus,
  type AiModelVersionRow,
} from '@/modules/ai/infrastructure/repositories/ai-model-registry-repository';

export interface RegisterModelInput {
  readonly key: string;
  readonly version: string;
  readonly provider: AiModelProvider;
  readonly status?: AiModelStatus;
  readonly description?: string;
  readonly config?: unknown;
}

export async function registerAiModelVersion(
  platformCtx: PlatformContext,
  input: RegisterModelInput,
): Promise<AiModelVersionRow> {
  if (!input.key.trim()) throw new Error('Model key is required.');
  if (!input.version.trim()) throw new Error('Model version is required.');

  const existing = await getAiModelVersionByKeyVersion(input.key, input.version);
  if (existing) {
    throw new Error(
      `Model version already registered: ${input.key}@${input.version}`,
    );
  }

  const row = await insertAiModelVersion({
    key: input.key.trim(),
    version: input.version.trim(),
    provider: input.provider,
    ...(input.status ? { status: input.status } : {}),
    description: input.description ?? null,
    config: input.config ?? {},
    registeredByPlatformUserId: platformCtx.platformUserId,
  });

  await recordPlatformAudit(platformCtx, {
    action: 'ai_model_registered',
    targetOrgId: null,
    targetEntityType: 'ai_model_versions',
    targetEntityId: row.id,
    metadata: {
      modelKey: row.key,
      modelVersion: row.version,
      provider: row.provider,
      status: row.status,
    },
  });

  return row;
}

export async function changeAiModelStatus(
  platformCtx: PlatformContext,
  input: { id: string; status: AiModelStatus },
): Promise<AiModelVersionRow> {
  const row = await setAiModelStatus({ id: input.id, status: input.status });
  await recordPlatformAudit(platformCtx, {
    action: 'ai_model_status_changed',
    targetOrgId: null,
    targetEntityType: 'ai_model_versions',
    targetEntityId: row.id,
    metadata: {
      modelKey: row.key,
      modelVersion: row.version,
      newStatus: row.status,
    },
  });
  return row;
}

export async function listModels(filter?: {
  status?: AiModelStatus;
}): Promise<AiModelVersionRow[]> {
  return listAiModelVersions(filter);
}
