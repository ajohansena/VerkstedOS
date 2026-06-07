import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * Schemas live in `src/db/schemas/` (one file per table, re-exported from the
 * barrel). SQL migrations are emitted to `migrations/`. RLS-policy migrations
 * are authored as dedicated `.sql` files alongside the generated ones
 * (see docs/08-security-deployment-scalability.md § Migration strategy).
 */
export default defineConfig({
  schema: './src/db/schemas/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
