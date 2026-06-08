/**
 * Drizzle schema barrel.
 *
 * One file per table under `src/db/schemas/<context>/`, re-exported here. This
 * is the single entry point Drizzle Kit reads (see drizzle.config.ts).
 */

// PostgreSQL enums (must be re-exported here so Drizzle Kit registers them)
export * from '../enums';

// Identity & Access
export { organizations } from './identity/organizations';
export { workshops } from './identity/workshops';
export { workshopDepartments } from './identity/workshop-departments';
export { users } from './identity/users';
export { memberships } from './identity/memberships';
export { roles } from './identity/roles';
export { rolePermissions } from './identity/role-permissions';
export { roleAssignments } from './identity/role-assignments';
export { userPermissionGrants } from './identity/user-permission-grants';
export { effectivePermissionsCache } from './identity/effective-permissions-cache';

// Customer & Vehicle
export { customers } from './customer/customers';
export { vehicles } from './customer/vehicles';
export { vegvesenLookups } from './customer/vegvesen-lookups';
export { phoneLookups1881 } from './customer/phone-lookups-1881';
export { vehicleOwnershipHistory } from './customer/vehicle-ownership-history';

// Case & Funding
export { cases } from './case/cases';
export { insuranceClaims } from './case/insurance-claims';
export { caseFundingSources } from './case/case-funding-sources';
export { caseParties } from './case/case-parties';
export { caseNotes } from './case/case-notes';

// Estimating & Integration
export { integrationInbox } from './estimating/integration-inbox';
export { estimateImports } from './estimating/estimate-imports';
export { estimateDocuments } from './estimating/estimate-documents';
export { estimateOperations } from './estimating/estimate-operations';
export { estimateLaborLines } from './estimating/estimate-labor-lines';
export { estimatePaintLines } from './estimating/estimate-paint-lines';
export { estimateParts } from './estimating/estimate-parts';
export { estimateTotals } from './estimating/estimate-totals';

// Production
export { workflowDefinitions } from './production/workflow-definitions';
export { workflowStates } from './production/workflow-states';
export { workflowTransitions } from './production/workflow-transitions';
export { productionOrders } from './production/production-orders';
export { productionStateHistory } from './production/production-state-history';
export { productionHolds } from './production/production-holds';
export { workSegments } from './production/work-segments';
export { tasks } from './production/tasks';
export { workSegmentDependencies } from './production/work-segment-dependencies';
export { resourceAssignments } from './production/resource-assignments';
export { capacityForecastSnapshots } from './production/capacity-forecast-snapshots';

// Workforce
export { employees } from './workforce/employees';
export { employeeSkills } from './workforce/employee-skills';
export { resources } from './workforce/resources';
export { shiftDefinitions } from './workforce/shift-definitions';
export { clockSessions } from './workforce/clock-sessions';
export { timeEntries } from './workforce/time-entries';
export { absenceTypes } from './workforce/absence-types';
export { absenceEntries } from './workforce/absence-entries';

// Parts & Procurement
export { suppliers } from './parts/suppliers';
export { supplierAgreements } from './parts/supplier-agreements';
export { partRequirements } from './parts/part-requirements';
export { purchaseOrders } from './parts/purchase-orders';
export { purchaseOrderLines } from './parts/purchase-order-lines';
export { partReceipts } from './parts/part-receipts';
export { partReceiptLines } from './parts/part-receipt-lines';
export { partReturns } from './parts/part-returns';
export { partReturnLines } from './parts/part-return-lines';
export { inventoryItems } from './parts/inventory-items';
export { inventoryStockMovements } from './parts/inventory-stock-movements';
export { inventoryWithdrawals } from './parts/inventory-withdrawals';
export { partLifecycleEvents } from './parts/part-lifecycle-events';

// Documents (cross-cutting)
export { documents } from './documents/documents';
export { documentLinks } from './documents/document-links';
export { documentAccessEvents } from './documents/document-access-events';

// Platform-shared catalogs
export { insuranceCompanies } from './platform/insurance-companies';

// Audit & Events
export { outboxEvents } from './audit/outbox-events';
export { failedEvents } from './audit/failed-events';

// Platform / Developer Control Plane
export { platformUsers } from './platform/platform-users';
export { platformRoleAssignments } from './platform/platform-role-assignments';
export { platformPermissions } from './platform/platform-permissions';
export { platformRolePermissions } from './platform/platform-role-permissions';

// NOTE: audit_events and platform_audit_events are partitioned tables created by
// hand-authored migrations; they are intentionally NOT exported here so
// drizzle-kit does not generate plain CREATE TABLE for them. Query them via the
// table objects in ./audit/audit-events and ./platform/platform-audit-events.

// Relations (centralized)
export * from '../relations';
