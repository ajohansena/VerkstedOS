import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Sql } from 'postgres';

/**
 * Minimal forward-only migration runner.
 *
 * Applies every `*.sql` file in `migrations/` in filename order, inside one
 * transaction per file, recording applied files in a `__migrations` table.
 * This covers BOTH Drizzle-generated migrations and the hand-authored RLS
 * `.sql` files that live alongside them (docs/03-data-model.md § Migrations).
 *
 * Statements are split on Drizzle's `--> statement-breakpoint` marker; files
 * without the marker are executed as a single batch.
 *
 * Used by `pnpm db:migrate` and by the tenant-isolation test harness so both
 * exercise the exact same SQL.
 */
export async function applyMigrations(
  sql: Sql,
  migrationsDir: string,
): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const already = await sql`
      SELECT 1 FROM "__migrations" WHERE "name" = ${file}
    `;
    if (already.length > 0) continue;

    const raw = await readFile(path.join(migrationsDir, file), 'utf8');
    const statements = raw
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO "__migrations" ("name") VALUES (${file})`;
    });

    applied.push(file);
  }

  return applied;
}
