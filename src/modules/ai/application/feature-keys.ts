/**
 * AI feature-flag keys (Sprint 21). One stable key per AI surface. Every key
 * is opt-in per org via the existing `feature_flags` infrastructure; default
 * is OFF (the global default row is absent → fallback `false`).
 *
 * Adding a new AI feature is a TWO-step change: (1) append a key here so
 * call-sites get type-safe gating; (2) call `isAiFeatureEnabled(orgId, key)`
 * before invoking the inference.
 */
export const AI_FEATURE_KEYS = {
  delayRisk: 'ai.delay_risk',
  etaEstimate: 'ai.eta_estimate',
  crossWorkshopTransfer: 'ai.cross_workshop_transfer',
  photoDamageClassification: 'ai.photo_damage_classification',
  partsSuggestion: 'ai.parts_suggestion',
} as const;

export type AiFeatureKey =
  (typeof AI_FEATURE_KEYS)[keyof typeof AI_FEATURE_KEYS];

export function isAiFeatureKey(value: string): value is AiFeatureKey {
  return (Object.values(AI_FEATURE_KEYS) as readonly string[]).includes(value);
}
