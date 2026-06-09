import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { aiPredictionKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * AI predictions projection (Sprint 21). Every prediction produced by an
 * AI model — regardless of whether the user acts on it — lands here so the
 * platform retains a full, explainable audit trail (inputs + rationale +
 * cost + latency). This is the foundation for accuracy retrospectives and
 * for the doc 06 "every prediction that affected a decision is recorded"
 * requirement.
 *
 * Tenant-scoped: an `ai_prediction` belongs to one organization (the org
 * whose case / segment / forecast triggered the call). Append-mostly: the
 * row is written once at inference; `groundTruth` is the only field updated
 * later when reality becomes known.
 */
export const aiPredictions = pgTable(
  'ai_predictions',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    /** Stable model identifier (matches `ai_model_versions.key`). */
    modelKey: varchar('model_key', { length: 64 }).notNull(),
    /** Version string at inference time (matches `ai_model_versions.version`). */
    modelVersion: varchar('model_version', { length: 64 }).notNull(),
    /** What was predicted. */
    kind: aiPredictionKind('kind').notNull(),
    /** The entity this prediction is about ('case', 'work_segment', etc.). */
    subjectType: varchar('subject_type', { length: 32 }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    /** The serialized inputs the model saw — must be sufficient to replay. */
    inputs: jsonb('inputs').notNull(),
    /** The structured output of the model. */
    output: jsonb('output').notNull(),
    /** Free-text explanation the model produced (doc 06 explainability rule). */
    rationale: text('rationale'),
    /** [0..1] confidence the model reports; null if not applicable. */
    confidence: numeric('confidence', { precision: 5, scale: 4 }),
    /** Inference latency in ms. */
    latencyMs: integer('latency_ms'),
    /** Cost charged in micro-USD (1e-6 USD). */
    costMicroUsd: integer('cost_micro_usd'),
    /** Captured later when ground-truth becomes known (for accuracy retros). */
    groundTruth: jsonb('ground_truth'),
    groundTruthCapturedAt: timestamp('ground_truth_captured_at', {
      withTimezone: true,
    }),
    ...lifecycleColumns,
  },
  (table) => [
    index('ai_predictions_org_idx').on(table.organizationId),
    index('ai_predictions_model_idx').on(table.modelKey, table.modelVersion),
    index('ai_predictions_subject_idx').on(table.subjectType, table.subjectId),
    index('ai_predictions_kind_idx').on(table.kind),
  ],
);
