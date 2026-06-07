import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { roles } from '@/db/schemas/identity/roles';
import { workshopDepartments } from '@/db/schemas/identity/workshop-departments';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * RoleAssignment — binds a role to a membership at a scope
 * (docs/05-multi-tenant-and-rbac.md). `workshop_id` NULL = org-wide;
 * `department_id` NULL = workshop-wide or org-wide. A user may hold many
 * assignments. `valid_from`/`valid_until` support temporary delegation.
 */
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'cascade',
    }),
    departmentId: uuid('department_id').references(
      () => workshopDepartments.id,
      { onDelete: 'cascade' },
    ),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    assignedByUserId: uuid('assigned_by_user_id'),
    ...lifecycleColumns,
  },
  (table) => [
    index('role_assignments_org_membership_idx').on(
      table.organizationId,
      table.membershipId,
    ),
    index('role_assignments_role_idx').on(table.roleId),
  ],
);
