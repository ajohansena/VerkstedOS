/**
 * Customer & Case — public surface for the Case context.
 *
 * The ONLY entry point other modules and the app may import from.
 */

export type {
  Case,
  CaseFundingSource,
  CaseParty,
  CaseNote,
  InsuranceClaim,
  CaseAssignment,
  CaseTransfer,
} from '@/db/types';

// Case intake & funding
export {
  createCase,
  addFundingSource,
} from '../application/services/case-intake';

export {
  createCaseSchema,
  fundingSourceInputSchema,
  validateFundingSource,
  validateFundingSet,
  type CreateCaseInput,
  type FundingSourceInput,
  type FundingSourceKind,
} from '../domain/case';

// Case-number formatting (pure)
export { formatCaseNumber } from '../infrastructure/repositories/case-number';

// Case reads
export {
  findCaseById,
  listFundingSources,
  listCaseParties,
  searchCases,
  listRecentCases,
  countCases,
  type CaseListItem,
} from '../infrastructure/repositories/case-repository';

// Multi-location: assignments + transfers (Sprint 13)
export {
  assignCaseToWorkshop,
  listAssignments,
} from '../application/services/assignments';

export {
  initiateTransfer,
  acceptTransfer,
  confirmArrival,
  cancelTransfer,
  listTransfers,
  listInboundTransfers,
  TransferValidationError,
  type InitiateTransferInput,
  type InboundTransfer,
} from '../application/services/transfers';
