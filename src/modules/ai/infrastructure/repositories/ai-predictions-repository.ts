import { and, desc, eq, isNull } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { aiPredictions } from '@/db/schemas/ai/ai-predictions';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * AI predictions projection repository (Sprint 21). Tenant-scoped via
 * `withTransaction(ctx, …)` for org reads/writes; cross-org read for the
 * platform inspector uses `getRawClient({ as: 'platform-inspector' })`.
 *
 * The projection is the explainability ledger: inputs + output + rationale +
 * cost + latency for every inference, regardless of whether the user acts on
 * the suggestion. Append-mostly; the only later update is the `groundTruth`
 * column when reality becomes known.
 */

export type AiPredictionKind =
  | 'delay_risk'
  | 'eta_estimate'
  | 'cross_workshop_transfer'
  | 'photo_damage_classification'
  | 'parts_suggestion'
  | 'generic';

export interface AiPredictionRow {
  readonly id: string;
  readonly organizationId: string;
  readonly modelKey: string;
  readonly modelVersion: string;
  readonly kind: AiPredictionKind;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly inputs: unknown;
  readonly output: unknown;
  readonly rationale: string | null;
  readonly confidence: string | null;
  readonly latencyMs: number | null;
  readonly costMicroUsd: number | null;
  readonly groundTruth: unknown;
  readonly groundTruthCapturedAt: Date | null;
  readonly createdAt: Date;
}

function toRow(r: typeof aiPredictions.$inferSelect): AiPredictionRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    modelKey: r.modelKey,
    modelVersion: r.modelVersion,
    kind: r.kind as AiPredictionKind,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    inputs: r.inputs,
    output: r.output,
    rationale: r.rationale,
    confidence: r.confidence,
    latencyMs: r.latencyMs,
    costMicroUsd: r.costMicroUsd,
    groundTruth: r.groundTruth,
    groundTruthCapturedAt: r.groundTruthCapturedAt,
    createdAt: r.createdAt,
  };
}

export interface InsertPredictionInput {
  readonly modelKey: string;
  readonly modelVersion: string;
  readonly kind: AiPredictionKind;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly inputs: unknown;
  readonly output: unknown;
  readonly rationale?: string | null;
  readonly confidence?: number | null;
  readonly latencyMs?: number | null;
  readonly costMicroUsd?: number | null;
}

export async function insertPrediction(
  ctx: RequestContext,
  input: InsertPredictionInput,
): Promise<AiPredictionRow> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(aiPredictions)
      .values({
        organizationId: ctx.organizationId,
        modelKey: input.modelKey,
        modelVersion: input.modelVersion,
        kind: input.kind,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        inputs: input.inputs as object,
        output: input.output as object,
        ...(input.rationale !== undefined
          ? { rationale: input.rationale }
          : {}),
        ...(input.confidence !== undefined && input.confidence !== null
          ? { confidence: String(input.confidence) }
          : {}),
        ...(input.latencyMs !== undefined
          ? { latencyMs: input.latencyMs }
          : {}),
        ...(input.costMicroUsd !== undefined
          ? { costMicroUsd: input.costMicroUsd }
          : {}),
      })
      .returning();
    return toRow(rows[0]!);
  });
}

export async function listPredictionsForSubject(
  ctx: RequestContext,
  subjectType: string,
  subjectId: string,
): Promise<AiPredictionRow[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(aiPredictions)
      .where(
        and(
          eq(aiPredictions.organizationId, ctx.organizationId),
          eq(aiPredictions.subjectType, subjectType),
          eq(aiPredictions.subjectId, subjectId),
          isNull(aiPredictions.deletedAt),
        ),
      )
      .orderBy(desc(aiPredictions.createdAt))
      .limit(50);
    return rows.map(toRow);
  });
}

export async function captureGroundTruth(
  ctx: RequestContext,
  input: { id: string; groundTruth: unknown },
): Promise<AiPredictionRow> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .update(aiPredictions)
      .set({
        groundTruth: input.groundTruth as object,
        groundTruthCapturedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiPredictions.id, input.id),
          eq(aiPredictions.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    return toRow(rows[0]!);
  });
}

/** Platform-inspector cross-org listing. */
export async function listPlatformPredictions(filter?: {
  kind?: AiPredictionKind;
  modelKey?: string;
  organizationId?: string;
}): Promise<AiPredictionRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const wheres = [isNull(aiPredictions.deletedAt)];
  if (filter?.kind) wheres.push(eq(aiPredictions.kind, filter.kind));
  if (filter?.modelKey)
    wheres.push(eq(aiPredictions.modelKey, filter.modelKey));
  if (filter?.organizationId)
    wheres.push(eq(aiPredictions.organizationId, filter.organizationId));
  const rows = await db
    .select()
    .from(aiPredictions)
    .where(and(...wheres))
    .orderBy(desc(aiPredictions.createdAt))
    .limit(200);
  return rows.map(toRow);
}
