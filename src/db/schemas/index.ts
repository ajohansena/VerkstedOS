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

// Customer & Vehicle
export { customers } from './customer/customers';
export { vehicles } from './customer/vehicles';

// Platform-shared catalogs
export { insuranceCompanies } from './platform/insurance-companies';

// Relations (centralized)
export * from '../relations';
