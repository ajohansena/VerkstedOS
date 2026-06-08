/**
 * Estimating & Integration — public surface.
 *
 * The ONLY entry point other modules and the app may import from.
 */

export type {
  EstimateImport,
  EstimateDocument,
  EstimateOperation,
  EstimateLaborLine,
  EstimatePaintLine,
  EstimatePart,
  EstimateTotals,
  IntegrationInbox,
} from '@/db/types';

// Import + lifecycle
export {
  receiveDbsPayload,
  importDbsEstimate,
  lockEstimate,
} from '../application/services/estimate-import';

export { allocateOperationFunding } from '../application/services/allocate-funding';

// Parser
export {
  parseDbsEstimate,
  DbsParseError,
  dbsEstimatePayloadSchema,
  type DbsEstimatePayload,
  type ParsedEstimate,
} from '../infrastructure/adapters/dbs-parser';

// Reads
export {
  listImportsForCase,
  findImportById,
  listOperations,
  listPaintLines,
  listParts,
  getTotals,
} from '../infrastructure/repositories/estimate-repository';

// Calculations (SSoT)
export {
  periodsToHours,
  hoursToPeriods,
  sumEstimateLabor,
  PERIODS_PER_HOUR,
  type EstimateLaborTotals,
} from '../application/calculations/estimate-labor';
