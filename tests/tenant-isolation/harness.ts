import path from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import postgres, { type Sql } from 'postgres';

import { applyMigrations } from '@/db/migrator';

/**
 * Tenant-isolation test harness.
 *
 * Spins a real Postgres, applies ALL migrations (schema + RLS), and creates a
 * dedicated NON-SUPERUSER role (`app_user`). RLS only constrains non-superuser
 * roles, so the isolation tests connect as `app_user` to genuinely exercise the
 * policies — exactly how the app must connect in production.
 *
 * Two connections are returned:
 *   - `admin`  : the container superuser (bypasses RLS) — used for seeding orgs
 *                and any setup that legitimately runs without org context.
 *   - `appUrl` : connection string for the non-superuser app role — feed this to
 *                the tenant-aware client (via DATABASE_URL) or a raw `postgres()`.
 */
export interface IsolationHarness {
  container: StartedPostgreSqlContainer;
  admin: Sql;
  appUrl: string;
  app: Sql;
  stop: () => Promise<void>;
}

const APP_ROLE = 'app_user';
const APP_PASSWORD = 'app_password';

export async function startIsolationHarness(): Promise<IsolationHarness> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const admin = postgres(container.getConnectionUri(), { max: 1 });

  // Apply schema + RLS migrations as the superuser.
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  await applyMigrations(admin, migrationsDir);

  // Create a non-superuser app role and grant table privileges. NO BYPASSRLS.
  await admin.unsafe(`
    DROP ROLE IF EXISTS ${APP_ROLE};
    CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}';
    GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_ROLE};
  `);

  const appUrl =
    `postgresql://${APP_ROLE}:${APP_PASSWORD}@` +
    `${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

  const app = postgres(appUrl, { max: 4 });

  return {
    container,
    admin,
    appUrl,
    app,
    stop: async () => {
      await app.end();
      await admin.end();
      await container.stop();
    },
  };
}
