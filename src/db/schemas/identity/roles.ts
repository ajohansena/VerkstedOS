import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Role — roles are DATA (docs/05-multi-tenant-and-rbac.md, ADR-018). Each org
 * gets seeded copies of the six standard roles; orgs may edit, duplicate, or
 * add their own. `isSystem` marks the seeded defaults (cannot be deleted, only
 * customized via role_permissions). `key` ties a system role back to its
 * standard definition for idempotent seeding.
 */
export const roles = pgTable(
  'roles',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Stable key for system roles (e.g. 'owner'); null for custom roles. */
    key: varchar('key', { length: 32 }),
    isSystem: boolean('is_system').notNull().default(false),
    ...lifecycleColumns,
  },
  (table) => [index('roles_org_idx').on(table.organizationId)],
);
