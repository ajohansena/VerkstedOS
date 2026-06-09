/**
 * AI module public API (Sprint 21). The ONLY entry point other modules / the
 * /dev surface / Server Actions may import from. Internal repos and adapter
 * implementations are private (depcruise-enforced).
 */

export {
  AI_FEATURE_KEYS,
  isAiFeatureKey,
  type AiFeatureKey,
} from '../application/feature-keys';

export {
  isAiFeatureEnabledForOrg,
  recordPrediction,
  listPredictionsForSubject,
  captureGroundTruth,
  AiFeatureDisabledError,
  AiModelNotRegisteredError,
  AiModelRetiredError,
  type RecordPredictionInput,
} from '../application/services/predictions';

export {
  registerAiModelVersion,
  changeAiModelStatus,
  listModels,
  type RegisterModelInput,
} from '../application/services/model-registry';

export {
  listPlatformPredictions,
  type AiPredictionRow,
  type AiPredictionKind,
} from '../infrastructure/repositories/ai-predictions-repository';

export {
  type AiModelVersionRow,
  type AiModelProvider,
  type AiModelStatus,
} from '../infrastructure/repositories/ai-model-registry-repository';

export type {
  AiProvider,
  AiInferenceRequest,
  AiInferenceResult,
} from '../application/ports/ai-provider';
