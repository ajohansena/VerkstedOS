import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { customers } from './schemas/customer/customers';
import type { vehicles } from './schemas/customer/vehicles';
import type { memberships } from './schemas/identity/memberships';
import type { organizations } from './schemas/identity/organizations';
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

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Vehicle = InferSelectModel<typeof vehicles>;
export type NewVehicle = InferInsertModel<typeof vehicles>;

export type InsuranceCompany = InferSelectModel<typeof insuranceCompanies>;
export type NewInsuranceCompany = InferInsertModel<typeof insuranceCompanies>;
