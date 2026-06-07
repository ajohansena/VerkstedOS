import path from 'node:path';

import postgres from 'postgres';

import { applyMigrations } from '../src/db/migrator';

/**
 * CLI entry for `pnpm db:migrate`. Applies all migrations (Drizzle-generated +
 * hand-authored RLS) against DATABASE_URL.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const dir = path.resolve(process.cwd(), 'migrations');
    const applied = await applyMigrations(sql, dir);
    if (applied.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${applied.length} migration(s):`);
      for (const file of applied) console.log(`  - ${file}`);
    }
  } finally {
    await sql.end();
  }
}

void main();
