/**
 * scripts/bootstrap-platform-owner.ts
 *
 * Provisions a PlatformOwner end-to-end:
 *   1. Supabase Auth (admin API): create-or-update the user with the given
 *      email + password (auto-confirmed so you can sign in immediately).
 *   2. App DB (DATABASE_URL_ADMIN): upsert into `users` with id = auth user id.
 *   3. App DB: upsert into `platform_users` (active).
 *   4. App DB: ensure a `PlatformOwner` row in `platform_role_assignments`
 *      (revoked_at is null).
 *
 * Usage:
 *   set -a && source .env.local && set +a && \
 *     pnpm tsx scripts/bootstrap-platform-owner.ts \
 *       --email ajohansena@gmail.com [--password '…'] [--name 'Andreas Johansena']
 *
 * If --password is omitted, the script reads it from stdin (hidden) so the
 * secret never lands in shell history.
 */

import { createInterface } from 'node:readline';

import { createClient as createAdminSupabase } from '@supabase/supabase-js';
import postgres from 'postgres';

type Args = { email: string; password?: string; name?: string };

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--email' && value) {
      out.email = value.trim().toLowerCase();
      i += 1;
    } else if (flag === '--password' && value) {
      out.password = value;
      i += 1;
    } else if (flag === '--name' && value) {
      out.name = value;
      i += 1;
    }
  }
  if (!out.email) {
    throw new Error('Missing required --email <address>');
  }
  return out as Args;
}

async function readPasswordFromStdin(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Mute echo while typing.
  const stdout = process.stdout as NodeJS.WriteStream & {
    _writeOriginal?: unknown;
  };
  const stdin = process.stdin;
  const wasRaw = stdin.isTTY ? stdin.isRaw : false;
  if (stdin.isTTY) stdin.setRawMode(true);
  process.stdout.write('Password (hidden): ');

  return await new Promise<string>((resolve) => {
    let buf = '';
    const onData = (chunk: Buffer): void => {
      const s = chunk.toString('utf8');
      for (const ch of s) {
        if (ch === '\n' || ch === '\r') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          process.stdout.write('\n');
          rl.close();
          resolve(buf);
          return;
        }
        if (ch === '\u0003') {
          // Ctrl-C
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on('data', onData);
    void stdout;
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl =
    process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL ?? '';

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    );
  }
  if (!dbUrl) {
    throw new Error('DATABASE_URL_ADMIN (or DATABASE_URL) must be set.');
  }

  const password = args.password ?? (await readPasswordFromStdin());
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  console.log(`\nBootstrapping PlatformOwner → ${args.email}`);
  console.log(`  Supabase project : ${new URL(supabaseUrl).host}`);
  console.log(
    `  App database     : ${new URL(dbUrl).host}:${new URL(dbUrl).port}`,
  );
  console.log('');

  // ─── 1. Supabase Auth ────────────────────────────────────────────────────
  const admin = createAdminSupabase(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (existing.error) throw existing.error;
  const found = existing.data.users.find(
    (u) => u.email?.toLowerCase() === args.email,
  );

  let authUserId: string;
  if (found) {
    const upd = await admin.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
      user_metadata: args.name ? { full_name: args.name } : found.user_metadata,
    });
    if (upd.error) throw upd.error;
    authUserId = found.id;
    console.log(`✔ Supabase Auth user updated (id=${authUserId})`);
  } else {
    const created = await admin.auth.admin.createUser({
      email: args.email,
      password,
      email_confirm: true,
      ...(args.name ? { user_metadata: { full_name: args.name } } : {}),
    });
    if (created.error) throw created.error;
    authUserId = created.data.user.id;
    console.log(`✔ Supabase Auth user created (id=${authUserId})`);
  }

  // ─── 2-4. App DB upserts ─────────────────────────────────────────────────
  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO users (id, email, full_name, status)
        VALUES (${authUserId}, ${args.email}, ${args.name ?? null}, 'active')
        ON CONFLICT (id) DO UPDATE
          SET email      = EXCLUDED.email,
              full_name  = COALESCE(EXCLUDED.full_name, users.full_name),
              status     = 'active',
              updated_at = now()
      `;
      console.log('✔ users row upserted');

      const pu = await tx<{ id: string }[]>`
        INSERT INTO platform_users (user_id, status, notes)
        VALUES (${authUserId}, 'active', 'Bootstrapped via scripts/bootstrap-platform-owner.ts')
        ON CONFLICT (user_id) DO UPDATE
          SET status     = 'active',
              updated_at = now()
        RETURNING id
      `;
      const platformUserId = pu[0]!.id;
      console.log(`✔ platform_users row upserted (id=${platformUserId})`);

      const existingRole = await tx<{ id: string }[]>`
        SELECT id FROM platform_role_assignments
        WHERE platform_user_id = ${platformUserId}
          AND role             = 'PlatformOwner'
          AND revoked_at IS NULL
        LIMIT 1
      `;

      if (existingRole.length === 0) {
        await tx`
          INSERT INTO platform_role_assignments (platform_user_id, role, reason)
          VALUES (${platformUserId}, 'PlatformOwner', 'Initial bootstrap')
        `;
        console.log('✔ PlatformOwner role granted');
      } else {
        console.log('✔ PlatformOwner role already active (no change)');
      }
    });
  } finally {
    await sql.end();
  }

  console.log(
    '\n🎉 Done. You can now sign in at /login with the credentials above.',
  );
  console.log(
    '   After signing in, /dev/* becomes accessible (PlatformOwner).',
  );
}

main().catch((err) => {
  console.error(
    '\n❌  Bootstrap failed:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
