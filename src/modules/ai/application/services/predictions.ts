/**
 * AI service (Sprint 21). The only entry-point business logic should use to
 * record a prediction. Enforces:
 *   1. The org has opted in via the feature flag.
 *   2. A live `ai_model_versions` row exists for the (key, version) pair.
 *   3. The model is `active` or `shadow` (retired models cannot be invoked).
 *   4. The prediction is appended to the explainability ledger.
 *   5. An audit event records that an AI-driven prediction was made.
 *
 * If the flag is OFF, `recordPrediction` returns null without inserting —
 * call-sites continue with their existing non-AI path.
 */

import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { withTransaction } from '@/db/client';
import { isFeatureEnabled } from '@/modules/platform/public';

import type { AiFeatureKey } from '@/modules/ai/application/feature-keys';
import {
  getAiModelVersionByKeyVersion,
  type AiModelVersionRow,
} from '@/modules/ai/infrastructure/repositories/ai-model-registry-repository';
import {
  insertPrediction,
  listPredictionsForSubject as listSubjectPredictions,
  captureGroundTruth as captureGT,
  type AiPredictionKind,
  type AiPredictionRow,
} from '@/modules/ai/infrastructure/repositories/ai-predictions-repository';

import type { RequestContext } from '@/lib/tenancy/context';

export class AiFeatureDisabledError extends Error {
  constructor(featureKey: AiFeatureKey) {
    super(`AI feature is disabled for this organization: ${featureKey}`);
    this.name = 'AiFeatureDisabledError';
  }
}

export class AiModelNotRegisteredError extends Error {
  constructor(key: string, version: string) {
    super(`AI model not registered: ${key}@${version}`);
    this.name = 'AiModelNotRegisteredError';
  }
}

export class AiModelRetiredError extends Error {
  constructor(key: string, version: string) {
    super(`AI model is retired: ${key}@${version}`);
    this.name = 'AiModelRetiredError';
  }
}

export interface RecordPredictionInput {
  readonly featureKey: AiFeatureKey;
  readonly modelKey: string;
  readonly modelVersion: string;
  readonly kind: AiPredictionKind;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly inputs: unknown;
  readonly output: unknown;
  readonly rationale?: string;
  readonly confidence?: number;
  readonly latencyMs?: number;
  readonly costMicroUsd?: number;
}

export async function isAiFeatureEnabledForOrg(
  organizationId: string,
  featureKey: AiFeatureKey,
): Promise<boolean> {
  return isFeatureEnabled(organizationId, featureKey, false);
}

/**
 * Record an AI prediction in the projection. Returns null when the feature
 * is OFF for the org (so the caller can degrade gracefully). Throws when
 * the model isn't registered or has been retired — those are configuration
 * bugs, not runtime conditions.
 */
export async function recordPrediction(
  ctx: RequestContext,
  input: RecordPredictionInput,
): Promise<AiPredictionRow | null> {
  if (!(await isAiFeatureEnabledForOrg(ctx.organizationId, input.featureKey))) {
    return null;
  }
  const model: AiModelVersionRow | null = await getAiModelVersionByKeyVersion(
    input.modelKey,
    input.modelVersion,
  );
  if (!model) {
    throw new AiModelNotRegisteredError(input.modelKey, input.modelVersion);
  }
  if (model.status === 'retired') {
    throw new AiModelRetiredError(input.modelKey, input.modelVersion);
  }

  const row = await insertPrediction(ctx, {
    modelKey: input.modelKey,
    modelVersion: input.modelVersion,
    kind: input.kind,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    inputs: input.inputs,
    output: input.output,
    rationale: input.rationale ?? null,
    confidence: input.confidence ?? null,
    latencyMs: input.latencyMs ?? null,
    costMicroUsd: input.costMicroUsd ?? null,
  });

  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'ai_predictions',
      entityId: row.id,
      after: {
        modelKey: row.modelKey,
        modelVersion: row.modelVersion,
        kind: row.kind,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        confidence: row.confidence,
      },
    });
  });

  return row;
}

export async function listPredictionsForSubject(
  ctx: RequestContext,
  subjectType: string,
  subjectId: string,
): Promise<AiPredictionRow[]> {
  return listSubjectPredictions(ctx, subjectType, subjectId);
}

export async function captureGroundTruth(
  ctx: RequestContext,
  input: { id: string; groundTruth: unknown },
): Promise<AiPredictionRow> {
  return captureGT(ctx, input);
}
