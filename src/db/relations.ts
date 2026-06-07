import { relations } from 'drizzle-orm';

import { customers } from './schemas/customer/customers';
import { vehicles } from './schemas/customer/vehicles';
import { memberships } from './schemas/identity/memberships';
import { organizations } from './schemas/identity/organizations';
import { users } from './schemas/identity/users';
import { workshopDepartments } from './schemas/identity/workshop-departments';
import { workshops } from './schemas/identity/workshops';

/**
 * Centralized Drizzle `relations(...)` declarations (docs/03-data-model.md).
 *
 * Keeping relations in one place (rather than scattered across schema files)
 * keeps cross-table wiring readable.
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  workshops: many(workshops),
  memberships: many(memberships),
}));

export const workshopsRelations = relations(workshops, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workshops.organizationId],
    references: [organizations.id],
  }),
  departments: many(workshopDepartments),
}));

export const workshopDepartmentsRelations = relations(
  workshopDepartments,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [workshopDepartments.organizationId],
      references: [organizations.id],
    }),
    workshop: one(workshops, {
      fields: [workshopDepartments.workshopId],
      references: [workshops.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  defaultWorkshop: one(workshops, {
    fields: [memberships.defaultWorkshopId],
    references: [workshops.id],
  }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  organization: one(organizations, {
    fields: [vehicles.organizationId],
    references: [organizations.id],
  }),
  ownerCustomer: one(customers, {
    fields: [vehicles.ownerCustomerId],
    references: [customers.id],
    relationName: 'vehicle_owner',
  }),
  userCustomer: one(customers, {
    fields: [vehicles.userCustomerId],
    references: [customers.id],
    relationName: 'vehicle_user',
  }),
}));
