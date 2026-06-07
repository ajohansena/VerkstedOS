import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { membershipStatus } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';
import { workshops } from '@/db/schemas/identity/workshops';

/**
 * Membership — the User-in-Organization link (docs/05-multi-tenant-and-rbac.md).
 *
 * A user with memberships in multiple organizations picks the active org in the
 * UI; that choice sets the org context for the session. Roles attach to a
 * membership in Sprint 3 (RBAC) — this sprint only establishes the link and the
 * default workshop.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: membershipStatus('status').notNull().default('active'),
    /** Workshop the user lands in by default; nullable for org-wide roles. */
    defaultWorkshopId: uuid('default_workshop_id').references(
      () => workshops.id,
      { onDelete: 'set null' },
    ),
    ...lifecycleColumns,
  },
  (table) => [
    unique('memberships_org_user_uq').on(table.organizationId, table.userId),
    index('memberships_user_idx').on(table.userId),
  ],
);
