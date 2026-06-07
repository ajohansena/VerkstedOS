import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { customers } from './schemas/customer/customers';
import type { vehicles } from './schemas/customer/vehicles';
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

export type InsuranceCompany = InferSelectModel<typeof insuranceCompanies>;
export type NewInsuranceCompany = InferInsertModel<typeof insuranceCompanies>;
