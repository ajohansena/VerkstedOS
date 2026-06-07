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
