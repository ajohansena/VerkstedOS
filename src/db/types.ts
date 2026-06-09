import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { customers } from './schemas/customer/customers';
import type { vehicles } from './schemas/customer/vehicles';
import type { vegvesenLookups } from './schemas/customer/vegvesen-lookups';
import type { phoneLookups1881 } from './schemas/customer/phone-lookups-1881';
import type { vehicleOwnershipHistory } from './schemas/customer/vehicle-ownership-history';
import type { cases } from './schemas/case/cases';
import type { insuranceClaims } from './schemas/case/insurance-claims';
import type { caseFundingSources } from './schemas/case/case-funding-sources';
import type { caseParties } from './schemas/case/case-parties';
import type { caseNotes } from './schemas/case/case-notes';
import type { caseAssignments } from './schemas/case/case-assignments';
import type { caseTransfers } from './schemas/case/case-transfers';
import type { integrationInbox } from './schemas/estimating/integration-inbox';
import type { estimateImports } from './schemas/estimating/estimate-imports';
import type { estimateDocuments } from './schemas/estimating/estimate-documents';
import type { estimateOperations } from './schemas/estimating/estimate-operations';
import type { estimateLaborLines } from './schemas/estimating/estimate-labor-lines';
import type { estimatePaintLines } from './schemas/estimating/estimate-paint-lines';
import type { estimateParts } from './schemas/estimating/estimate-parts';
import type { estimateTotals } from './schemas/estimating/estimate-totals';
import type { workflowDefinitions } from './schemas/production/workflow-definitions';
import type { workflowStates } from './schemas/production/workflow-states';
import type { workflowTransitions } from './schemas/production/workflow-transitions';
import type { productionOrders } from './schemas/production/production-orders';
import type { productionStateHistory } from './schemas/production/production-state-history';
import type { productionHolds } from './schemas/production/production-holds';
import type { workSegments } from './schemas/production/work-segments';
import type { tasks } from './schemas/production/tasks';
import type { workSegmentDependencies } from './schemas/production/work-segment-dependencies';
import type { resourceAssignments } from './schemas/production/resource-assignments';
import type { capacityForecastSnapshots } from './schemas/production/capacity-forecast-snapshots';
import type { employees } from './schemas/workforce/employees';
import type { employeeSkills } from './schemas/workforce/employee-skills';
import type { resources } from './schemas/workforce/resources';
import type { shiftDefinitions } from './schemas/workforce/shift-definitions';
import type { clockSessions } from './schemas/workforce/clock-sessions';
import type { timeEntries } from './schemas/workforce/time-entries';
import type { absenceTypes } from './schemas/workforce/absence-types';
import type { absenceEntries } from './schemas/workforce/absence-entries';
import type { suppliers } from './schemas/parts/suppliers';
import type { supplierAgreements } from './schemas/parts/supplier-agreements';
import type { partRequirements } from './schemas/parts/part-requirements';
import type { purchaseOrders } from './schemas/parts/purchase-orders';
import type { purchaseOrderLines } from './schemas/parts/purchase-order-lines';
import type { partReceipts } from './schemas/parts/part-receipts';
import type { partReceiptLines } from './schemas/parts/part-receipt-lines';
import type { partReturns } from './schemas/parts/part-returns';
import type { partReturnLines } from './schemas/parts/part-return-lines';
import type { inventoryItems } from './schemas/parts/inventory-items';
import type { inventoryStockMovements } from './schemas/parts/inventory-stock-movements';
import type { inventoryWithdrawals } from './schemas/parts/inventory-withdrawals';
import type { partLifecycleEvents } from './schemas/parts/part-lifecycle-events';
import type { supplierInvoices } from './schemas/parts/supplier-invoices';
import type { supplierInvoiceLines } from './schemas/parts/supplier-invoice-lines';
import type { supplierCreditNotes } from './schemas/parts/supplier-credit-notes';
import type { supplierCreditNoteLines } from './schemas/parts/supplier-credit-note-lines';
import type { invoiceBasis } from './schemas/finance/invoice-basis';
import type { invoiceBasisLines } from './schemas/finance/invoice-basis-lines';
import type { accountingExports } from './schemas/finance/accounting-exports';
import type { accountingExportLines } from './schemas/finance/accounting-export-lines';
import type { documents } from './schemas/documents/documents';
import type { documentLinks } from './schemas/documents/document-links';
import type { documentAccessEvents } from './schemas/documents/document-access-events';
import type { checklistTemplates } from './schemas/quality/checklist-templates';
import type { checklistTemplateItems } from './schemas/quality/checklist-template-items';
import type { checklistRuns } from './schemas/quality/checklist-runs';
import type { checklistResponses } from './schemas/quality/checklist-responses';
import type { qualityDeviations } from './schemas/quality/quality-deviations';
import type { digitalSignatures } from './schemas/quality/digital-signatures';
import type { communicationThreads } from './schemas/communication/communication-threads';
import type { communicationMessages } from './schemas/communication/communication-messages';
import type { caseAcceptances } from './schemas/communication/case-acceptances';
import type { effectivePermissionsCache } from './schemas/identity/effective-permissions-cache';
import type { memberships } from './schemas/identity/memberships';
import type { organizations } from './schemas/identity/organizations';
import type { roleAssignments } from './schemas/identity/role-assignments';
import type { rolePermissions } from './schemas/identity/role-permissions';
import type { roles } from './schemas/identity/roles';
import type { userPermissionGrants } from './schemas/identity/user-permission-grants';
import type { users } from './schemas/identity/users';
import type { workshopDepartments } from './schemas/identity/workshop-departments';
import type { workshops } from './schemas/identity/workshops';
import type { insuranceCompanies } from './schemas/platform/insurance-companies';
import type { outboxEvents } from './schemas/audit/outbox-events';
import type { failedEvents } from './schemas/audit/failed-events';
import type { auditEvents } from './schemas/audit/audit-events';
import type { platformUsers } from './schemas/platform/platform-users';
import type { featureFlags } from './schemas/platform/feature-flags';
import type { platformImpersonationSessions } from './schemas/platform/platform-impersonation-sessions';
import type { platformRoleAssignments } from './schemas/platform/platform-role-assignments';
import type { platformAuditEvents } from './schemas/platform/platform-audit-events';

/**
 * Inferred row types for the schema. Exposed from here so application and
 * presentation layers never import Drizzle table objects directly.
 */

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export type Workshop = InferSelectModel<typeof workshops>;
export type NewWorkshop = InferInsertModel<typeof workshops>;

export type WorkshopDepartment = InferSelectModel<typeof workshopDepartments>;
export type NewWorkshopDepartment = InferInsertModel<
  typeof workshopDepartments
>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;

export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;

export type RolePermission = InferSelectModel<typeof rolePermissions>;
export type NewRolePermission = InferInsertModel<typeof rolePermissions>;

export type RoleAssignment = InferSelectModel<typeof roleAssignments>;
export type NewRoleAssignment = InferInsertModel<typeof roleAssignments>;

export type UserPermissionGrant = InferSelectModel<typeof userPermissionGrants>;
export type NewUserPermissionGrant = InferInsertModel<
  typeof userPermissionGrants
>;

export type EffectivePermission = InferSelectModel<
  typeof effectivePermissionsCache
>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Vehicle = InferSelectModel<typeof vehicles>;
export type NewVehicle = InferInsertModel<typeof vehicles>;

export type VegvesenLookup = InferSelectModel<typeof vegvesenLookups>;
export type NewVegvesenLookup = InferInsertModel<typeof vegvesenLookups>;

export type PhoneLookup1881 = InferSelectModel<typeof phoneLookups1881>;
export type NewPhoneLookup1881 = InferInsertModel<typeof phoneLookups1881>;

export type VehicleOwnershipHistory = InferSelectModel<
  typeof vehicleOwnershipHistory
>;
export type NewVehicleOwnershipHistory = InferInsertModel<
  typeof vehicleOwnershipHistory
>;

export type Case = InferSelectModel<typeof cases>;
export type NewCase = InferInsertModel<typeof cases>;

export type InsuranceClaim = InferSelectModel<typeof insuranceClaims>;
export type NewInsuranceClaim = InferInsertModel<typeof insuranceClaims>;

export type CaseFundingSource = InferSelectModel<typeof caseFundingSources>;
export type NewCaseFundingSource = InferInsertModel<typeof caseFundingSources>;

export type CaseParty = InferSelectModel<typeof caseParties>;
export type NewCaseParty = InferInsertModel<typeof caseParties>;

export type CaseNote = InferSelectModel<typeof caseNotes>;
export type NewCaseNote = InferInsertModel<typeof caseNotes>;

export type CaseAssignment = InferSelectModel<typeof caseAssignments>;
export type NewCaseAssignment = InferInsertModel<typeof caseAssignments>;

export type CaseTransfer = InferSelectModel<typeof caseTransfers>;
export type NewCaseTransfer = InferInsertModel<typeof caseTransfers>;

export type IntegrationInbox = InferSelectModel<typeof integrationInbox>;
export type NewIntegrationInbox = InferInsertModel<typeof integrationInbox>;

export type EstimateImport = InferSelectModel<typeof estimateImports>;
export type NewEstimateImport = InferInsertModel<typeof estimateImports>;

export type EstimateDocument = InferSelectModel<typeof estimateDocuments>;
export type NewEstimateDocument = InferInsertModel<typeof estimateDocuments>;

export type EstimateOperation = InferSelectModel<typeof estimateOperations>;
export type NewEstimateOperation = InferInsertModel<typeof estimateOperations>;

export type EstimateLaborLine = InferSelectModel<typeof estimateLaborLines>;
export type NewEstimateLaborLine = InferInsertModel<typeof estimateLaborLines>;

export type EstimatePaintLine = InferSelectModel<typeof estimatePaintLines>;
export type NewEstimatePaintLine = InferInsertModel<typeof estimatePaintLines>;

export type EstimatePart = InferSelectModel<typeof estimateParts>;
export type NewEstimatePart = InferInsertModel<typeof estimateParts>;

export type EstimateTotals = InferSelectModel<typeof estimateTotals>;
export type NewEstimateTotals = InferInsertModel<typeof estimateTotals>;

export type WorkflowDefinition = InferSelectModel<typeof workflowDefinitions>;
export type NewWorkflowDefinition = InferInsertModel<
  typeof workflowDefinitions
>;

export type WorkflowState = InferSelectModel<typeof workflowStates>;
export type NewWorkflowState = InferInsertModel<typeof workflowStates>;

export type WorkflowTransition = InferSelectModel<typeof workflowTransitions>;
export type NewWorkflowTransition = InferInsertModel<
  typeof workflowTransitions
>;

export type ProductionOrder = InferSelectModel<typeof productionOrders>;
export type NewProductionOrder = InferInsertModel<typeof productionOrders>;

export type ProductionStateHistory = InferSelectModel<
  typeof productionStateHistory
>;
export type NewProductionStateHistory = InferInsertModel<
  typeof productionStateHistory
>;

export type ProductionHold = InferSelectModel<typeof productionHolds>;
export type NewProductionHold = InferInsertModel<typeof productionHolds>;

export type WorkSegment = InferSelectModel<typeof workSegments>;
export type NewWorkSegment = InferInsertModel<typeof workSegments>;

export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export type WorkSegmentDependency = InferSelectModel<
  typeof workSegmentDependencies
>;
export type NewWorkSegmentDependency = InferInsertModel<
  typeof workSegmentDependencies
>;

export type ResourceAssignment = InferSelectModel<typeof resourceAssignments>;
export type NewResourceAssignment = InferInsertModel<
  typeof resourceAssignments
>;

export type CapacityForecastSnapshot = InferSelectModel<
  typeof capacityForecastSnapshots
>;
export type NewCapacityForecastSnapshot = InferInsertModel<
  typeof capacityForecastSnapshots
>;

export type Employee = InferSelectModel<typeof employees>;
export type NewEmployee = InferInsertModel<typeof employees>;

export type EmployeeSkill = InferSelectModel<typeof employeeSkills>;
export type NewEmployeeSkill = InferInsertModel<typeof employeeSkills>;

export type Resource = InferSelectModel<typeof resources>;
export type NewResource = InferInsertModel<typeof resources>;

export type ShiftDefinition = InferSelectModel<typeof shiftDefinitions>;
export type NewShiftDefinition = InferInsertModel<typeof shiftDefinitions>;

export type ClockSession = InferSelectModel<typeof clockSessions>;
export type NewClockSession = InferInsertModel<typeof clockSessions>;

export type TimeEntry = InferSelectModel<typeof timeEntries>;
export type NewTimeEntry = InferInsertModel<typeof timeEntries>;

export type AbsenceType = InferSelectModel<typeof absenceTypes>;
export type NewAbsenceType = InferInsertModel<typeof absenceTypes>;

export type AbsenceEntry = InferSelectModel<typeof absenceEntries>;
export type NewAbsenceEntry = InferInsertModel<typeof absenceEntries>;

export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;

export type SupplierAgreement = InferSelectModel<typeof supplierAgreements>;
export type NewSupplierAgreement = InferInsertModel<typeof supplierAgreements>;

export type PartRequirement = InferSelectModel<typeof partRequirements>;
export type NewPartRequirement = InferInsertModel<typeof partRequirements>;

export type PurchaseOrder = InferSelectModel<typeof purchaseOrders>;
export type NewPurchaseOrder = InferInsertModel<typeof purchaseOrders>;

export type PurchaseOrderLine = InferSelectModel<typeof purchaseOrderLines>;
export type NewPurchaseOrderLine = InferInsertModel<typeof purchaseOrderLines>;

export type PartReceipt = InferSelectModel<typeof partReceipts>;
export type NewPartReceipt = InferInsertModel<typeof partReceipts>;

export type PartReceiptLine = InferSelectModel<typeof partReceiptLines>;
export type NewPartReceiptLine = InferInsertModel<typeof partReceiptLines>;

export type PartReturn = InferSelectModel<typeof partReturns>;
export type NewPartReturn = InferInsertModel<typeof partReturns>;

export type PartReturnLine = InferSelectModel<typeof partReturnLines>;
export type NewPartReturnLine = InferInsertModel<typeof partReturnLines>;

export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type NewInventoryItem = InferInsertModel<typeof inventoryItems>;

export type InventoryStockMovement = InferSelectModel<
  typeof inventoryStockMovements
>;
export type NewInventoryStockMovement = InferInsertModel<
  typeof inventoryStockMovements
>;

export type InventoryWithdrawal = InferSelectModel<typeof inventoryWithdrawals>;
export type NewInventoryWithdrawal = InferInsertModel<
  typeof inventoryWithdrawals
>;

export type PartLifecycleEvent = InferSelectModel<typeof partLifecycleEvents>;
export type NewPartLifecycleEvent = InferInsertModel<
  typeof partLifecycleEvents
>;

export type SupplierInvoice = InferSelectModel<typeof supplierInvoices>;
export type NewSupplierInvoice = InferInsertModel<typeof supplierInvoices>;
export type SupplierInvoiceLine = InferSelectModel<typeof supplierInvoiceLines>;
export type NewSupplierInvoiceLine = InferInsertModel<
  typeof supplierInvoiceLines
>;
export type SupplierCreditNote = InferSelectModel<typeof supplierCreditNotes>;
export type NewSupplierCreditNote = InferInsertModel<
  typeof supplierCreditNotes
>;
export type SupplierCreditNoteLine = InferSelectModel<
  typeof supplierCreditNoteLines
>;
export type NewSupplierCreditNoteLine = InferInsertModel<
  typeof supplierCreditNoteLines
>;

export type InvoiceBasis = InferSelectModel<typeof invoiceBasis>;
export type NewInvoiceBasis = InferInsertModel<typeof invoiceBasis>;
export type InvoiceBasisLine = InferSelectModel<typeof invoiceBasisLines>;
export type NewInvoiceBasisLine = InferInsertModel<typeof invoiceBasisLines>;
export type AccountingExport = InferSelectModel<typeof accountingExports>;
export type NewAccountingExport = InferInsertModel<typeof accountingExports>;
export type AccountingExportLine = InferSelectModel<
  typeof accountingExportLines
>;
export type NewAccountingExportLine = InferInsertModel<
  typeof accountingExportLines
>;

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

export type DocumentLink = InferSelectModel<typeof documentLinks>;
export type NewDocumentLink = InferInsertModel<typeof documentLinks>;

export type DocumentAccessEvent = InferSelectModel<typeof documentAccessEvents>;
export type NewDocumentAccessEvent = InferInsertModel<
  typeof documentAccessEvents
>;

export type ChecklistTemplate = InferSelectModel<typeof checklistTemplates>;
export type NewChecklistTemplate = InferInsertModel<typeof checklistTemplates>;

export type ChecklistTemplateItem = InferSelectModel<
  typeof checklistTemplateItems
>;
export type NewChecklistTemplateItem = InferInsertModel<
  typeof checklistTemplateItems
>;

export type ChecklistRun = InferSelectModel<typeof checklistRuns>;
export type NewChecklistRun = InferInsertModel<typeof checklistRuns>;

export type ChecklistResponse = InferSelectModel<typeof checklistResponses>;
export type NewChecklistResponse = InferInsertModel<typeof checklistResponses>;

export type QualityDeviation = InferSelectModel<typeof qualityDeviations>;
export type NewQualityDeviation = InferInsertModel<typeof qualityDeviations>;

export type DigitalSignature = InferSelectModel<typeof digitalSignatures>;
export type NewDigitalSignature = InferInsertModel<typeof digitalSignatures>;

export type CommunicationThread = InferSelectModel<typeof communicationThreads>;
export type NewCommunicationThread = InferInsertModel<
  typeof communicationThreads
>;

export type CommunicationMessage = InferSelectModel<
  typeof communicationMessages
>;
export type NewCommunicationMessage = InferInsertModel<
  typeof communicationMessages
>;

export type CaseAcceptance = InferSelectModel<typeof caseAcceptances>;
export type NewCaseAcceptance = InferInsertModel<typeof caseAcceptances>;

export type InsuranceCompany = InferSelectModel<typeof insuranceCompanies>;
export type NewInsuranceCompany = InferInsertModel<typeof insuranceCompanies>;

export type OutboxEvent = InferSelectModel<typeof outboxEvents>;
export type NewOutboxEvent = InferInsertModel<typeof outboxEvents>;

export type FailedEvent = InferSelectModel<typeof failedEvents>;
export type NewFailedEvent = InferInsertModel<typeof failedEvents>;

export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type NewAuditEvent = InferInsertModel<typeof auditEvents>;

export type PlatformUser = InferSelectModel<typeof platformUsers>;
export type NewPlatformUser = InferInsertModel<typeof platformUsers>;

export type FeatureFlag = InferSelectModel<typeof featureFlags>;
export type NewFeatureFlag = InferInsertModel<typeof featureFlags>;

export type PlatformImpersonationSession = InferSelectModel<
  typeof platformImpersonationSessions
>;
export type NewPlatformImpersonationSession = InferInsertModel<
  typeof platformImpersonationSessions
>;

export type PlatformRoleAssignment = InferSelectModel<
  typeof platformRoleAssignments
>;
export type NewPlatformRoleAssignment = InferInsertModel<
  typeof platformRoleAssignments
>;

export type PlatformAuditEvent = InferSelectModel<typeof platformAuditEvents>;
export type NewPlatformAuditEvent = InferInsertModel<
  typeof platformAuditEvents
>;
