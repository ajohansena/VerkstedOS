/**
 * AI provider port (Sprint 21). The minimal abstraction every AI feature
 * speaks to. Concrete adapters (internal model service, OpenAI-compatible,
 * custom) implement this interface and are dispatched on the `provider`
 * column of the registered model version.
 *
 * No concrete adapter ships in Sprint 21 — the framework + projection +
 * gating is the deliverable. Sprint 22+ introduces real adapters as
 * specific AI features land.
 */

import type { AiPredictionKind } from '@/modules/ai/infrastructure/repositories/ai-predictions-repository';

export interface AiInferenceRequest {
  readonly modelKey: string;
  readonly modelVersion: string;
  readonly kind: AiPredictionKind;
  readonly inputs: unknown;
}

export interface AiInferenceResult {
  readonly output: unknown;
  readonly rationale?: string;
  readonly confidence?: number;
  readonly latencyMs: number;
  readonly costMicroUsd?: number;
}

export interface AiProvider {
  readonly name: 'internal' | 'openai_compatible' | 'custom';
  infer(request: AiInferenceRequest): Promise<AiInferenceResult>;
}
