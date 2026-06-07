import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { grantKind } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { memberships } from '@/db/schemas/identity/memberships';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshopDepartments } from '@/db/schemas/identity/workshop-departments';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * UserPermissionGrant — direct grant/deny overrides outside roles
 * (docs/05-multi-tenant-and-rbac.md). `kind = 'deny'` revokes a permission a
 * role would otherwise grant; DENY WINS over grant. A power tool with a paper
 * trail — `reason` is required.
 */
export const userPermissionGrants = pgTable(
  'user_permission_grants',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    permissionCode: varchar('permission_code', { length: 64 }).notNull(),
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'cascade',
    }),
    departmentId: uuid('department_id').references(
      () => workshopDepartments.id,
      { onDelete: 'cascade' },
    ),
    kind: grantKind('kind').notNull(),
    reason: text('reason').notNull(),
    grantedByUserId: uuid('granted_by_user_id'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    index('user_permission_grants_org_membership_idx').on(
      table.organizationId,
      table.membershipId,
    ),
  ],
);
