/**
 * Quality — public surface (docs/03-data-model.md, docs/10-production-domain.md).
 *
 * Per-workshop configurable QC checklists, runs with pass/fail derived from
 * responses (comment/photo required on failure), and quality deviations with
 * separable internal-rework tracking. The ONLY entry point for other modules
 * and the app.
 */

export type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistRun,
  ChecklistResponse,
  QualityDeviation,
} from '@/db/types';

// Templates (admin)
export {
  createChecklistTemplate,
  listChecklistTemplates,
  listTemplateItems,
  type CreateTemplateInput,
  type TemplateItemInput,
} from '../application/services/templates';

export { DEFAULT_CHECKLIST_TEMPLATES } from '../application/services/default-checklists';

// Runs (perform QC)
export {
  startChecklistRun,
  respondToItem,
  signOffRun,
  listChecklistRuns,
  listResponses,
  QcValidationError,
  type RespondInput,
} from '../application/services/runs';

// Deviations
export {
  raiseDeviation,
  resolveDeviation,
  listDeviations,
  type RaiseDeviationInput,
} from '../application/services/deviations';

// Calculations (SSoT)
export {
  calculateQcFailureRate,
  calculateReworkRate,
  type QcFailureRateResult,
  type ReworkRateResult,
  type ChecklistRunOutcome,
} from '../application/calculations/qc-metrics';

// Digital signatures (tamper-evident chain)
export {
  appendSignature,
  listSignatures,
  verifyCaseChain,
  verifyCaseChainAdmin,
  type SignInput,
} from '../application/services/signatures';

export {
  hashPayload,
  computeChainHash,
  verifyChain,
  type VerifyResult,
  type ChainEntry,
} from '../application/calculations/signature-chain';
