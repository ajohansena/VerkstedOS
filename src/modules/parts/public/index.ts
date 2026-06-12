/**
 * Parts & Procurement — public surface.
 *
 * The ONLY entry point other modules and the app may import from. Parts flow
 * through a full lifecycle off the PartRequirement spine: flag → order →
 * receive → withdraw → return, with a timeline projection and a canonical
 * reconciliation calculation (SSoT).
 *
 * GUARDRAIL (TakstKontroll, CLAUDE.md § 4.7): case-level traceability and
 * funding tagging are preserved on every line of the flow.
 */

export type {
  Supplier,
  SupplierAgreement,
  PartRequirement,
  PurchaseOrder,
  PurchaseOrderLine,
  PartReceipt,
  PartReturn,
  InventoryItem,
  InventoryWithdrawal,
  PartLifecycleEvent,
  SupplierInvoice,
  SupplierInvoiceLine,
  SupplierCreditNote,
  SupplierCreditNoteLine,
} from '@/db/types';

// Requirements (the spine)
export {
  flagPartRequirement,
  listPartRequirements,
  cancelPartRequirement,
  materializeRequirementsFromApprovedEstimate,
  type FlagPartInput,
  type MaterializeRequirementsResult,
} from '../application/services/part-requirements';

// Procurement
export {
  createSupplier,
  listSuppliers,
  createPurchaseOrder,
  sendPurchaseOrder,
  listPurchaseOrderLines,
  type CreatePurchaseOrderInput,
  type OrderLineInput,
} from '../application/services/procurement';

// Receiving
export {
  receiveParts,
  type ReceivePartsInput,
  type ReceiveLineInput,
} from '../application/services/receiving';

// Inventory
export {
  upsertInventoryItem,
  listInventory,
  withdrawToCase,
  InsufficientStockError,
  type WithdrawInput,
} from '../application/services/inventory';

// Returns
export {
  createPartReturn,
  type CreateReturnInput,
  type ReturnLineInput,
} from '../application/services/returns';

// Reads + reconciliation (SSoT)
export {
  reconcileCaseParts,
  listCaseLifecycle,
  listOpenRequirements,
  listOpenPoLinesForRequirement,
  type ReconciledRequirement,
  type CoordinatorRequirement,
  type OpenPoLineForRequirement,
} from '../infrastructure/repositories/parts-read-repository';

export {
  reconcilePartRequirement,
  type ReconciliationInput,
  type ReconciliationResult,
  type ReconciliationState,
} from '../application/calculations/reconciliation';

// Supplier invoicing (Sprint 14 Track F)
export {
  createSupplierInvoice,
  addInvoiceLine,
  bookInvoice,
  createCreditNote,
  addCreditLine,
  type CreateInvoiceInput,
  type AddInvoiceLineInput,
  type CreateCreditNoteInput,
  type AddCreditLineInput,
} from '../application/services/invoicing';

export {
  listSupplierInvoices,
  findSupplierInvoice,
  type SupplierInvoiceListItem,
  type SupplierInvoiceDetail,
} from '../infrastructure/repositories/supplier-invoice-read-repository';

export {
  calculateInvoiceMatch,
  type InvoiceMatchInput,
  type InvoiceMatchResult,
  type InvoiceMatchState,
} from '../application/calculations/invoice-match';
