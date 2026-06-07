import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

/**
 * Platform permission catalog table (docs/06-developer-control-plane.md).
 *
 * Platform permissions are code-defined (src/lib/permissions/platform-catalog.ts);
 * this table is the seeded mirror so platform_role_permissions can reference a
 * canonical list. Code is the source of truth; the seed keeps the table in sync.
 */
export const platformPermissions = pgTable('platform_permissions', {
  code: varchar('code', { length: 64 }).primaryKey(),
  description: text('description').notNull(),
});
