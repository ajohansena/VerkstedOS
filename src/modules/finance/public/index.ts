/**
 * Finance — public surface (Sprint 15).
 *
 * Invoice basis generation per funding source (with the deductible split),
 * approval, and immutable accounting export to Tripletex. The ONLY entry point
 * other modules and the app may import from.
 *
 * TakstKontroll (CLAUDE.md § 4.7): every basis + line stays attributable to its
 * case and funding source; internal cost (goodwill / rework) is a separate
 * basis kind that never mixes with externally-invoiced amounts.
 */

export type {
  InvoiceBasis,
  InvoiceBasisLine,
  AccountingExport,
  AccountingExportLine,
} from '@/db/types';

// Calculations (SSoT)
export {
  calculateLineVat,
  calculateInvoiceBasisTotals,
  roundOre,
  DEFAULT_VAT_RATE,
  type LineVatInput,
  type LineVatResult,
  type BasisTotalsResult,
} from '../application/calculations/invoice-vat';

export {
  planInvoiceBases,
  type PlannedBasis,
  type PlannedLine,
  type PlanInput,
} from '../application/calculations/plan-invoice-bases';

// Services
export {
  generateInvoiceBasisForCase,
  approveInvoiceBasis,
  cancelInvoiceBasis,
  type GenerateResult,
} from '../application/services/invoice-basis';

export {
  exportApprovedBases,
  retryExport,
} from '../application/services/accounting-export';

// Reads
export {
  listInvoiceBasesForCase,
  findInvoiceBasis,
  listApprovedBases,
  listAccountingExports,
  findAccountingExport,
  accountingExportStats,
  type InvoiceBasisWithLines,
  type AccountingExportWithLines,
  type AccountingExportStats,
} from '../infrastructure/repositories/finance-repository';

// Integration adapter (Dev surface + config checks)
export {
  tripletexConfigured,
  type TripletexSource,
} from '../infrastructure/adapters/tripletex-adapter';
