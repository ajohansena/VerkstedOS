import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schemas';

/**
 * Sprint 1: raw, non-tenant-aware Drizzle client.
 *
 * Service code does not exist yet, so there is nothing to enforce against.
 *
 * Sprint 2 replaces this with a tenant-aware factory that REQUIRES a
 * RequestContext and runs `SET LOCAL app.current_org_id = …` (and friends)
 * per transaction. Obtaining a raw client will then require an explicit
 * `as: 'admin' | 'integration' | 'platform-inspector'` argument so it is
 * grep-able. See docs/05-multi-tenant-and-rbac.md.
 *
 * The connection is created lazily by `postgres-js`; no socket is opened until
 * the first query runs, so importing this module is safe before DATABASE_URL
 * is configured.
 */
const connectionString = process.env.DATABASE_URL ?? '';

const queryClient = postgres(connectionString, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
