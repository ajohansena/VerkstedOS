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
