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
 *       --email ajohansena@gmail.com [--password '…'] [--name 'Andreas Johansena'] \
 *       [--customer-org <uuid> --customer-role owner]
 *
 * If --password is omitted, the script reads it from stdin (hidden) so the
 * secret never lands in shell history.
 *
 * If --customer-org is provided, the user is also (idempotently) given an
 * active membership in that organization and the role identified by
 * --customer-role (default: 'owner') so a fresh login lands in a working org
 * instead of an empty-state. This is what makes the account usable end-to-end
 * on a new deployment that has no seed data.
 *
 * If a legacy `users` row with the same email but a different id exists (e.g.
 * a synthetic seed UUID from scripts/seed-demo.ts), its memberships are
 * migrated to the real Supabase Auth user id and the legacy row is removed.
 */

import { createInterface } from 'node:readline';

import { createClient as createAdminSupabase } from '@supabase/supabase-js';
import postgres from 'postgres';

type Args = {
  email: string;
  password?: string;
  name?: string;
  /** Optional customer org membership: pass org id (UUID). */
  customerOrg?: string;
  /** Optional role key in that org (default 'owner'). Requires --customer-org. */
  customerRole?: string;
};

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
    } else if (flag === '--customer-org' && value) {
      out.customerOrg = value;
      i += 1;
    } else if (flag === '--customer-role' && value) {
      out.customerRole = value.toLowerCase();
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
      // ─── 2a. Legacy seed-user migration ──────────────────────────────────
      // The local dev DB may already contain a `users` row for this email
      // with a synthetic seed UUID (e.g. 00000000-…-0a000a) that does NOT
      // match the cloud Supabase Auth user id. The email column is unique,
      // so we must repoint any existing memberships / employees etc. to the
      // real auth UUID and then delete the legacy row.
      const legacy = await tx<{ id: string }[]>`
        SELECT id FROM users WHERE email = ${args.email} AND id <> ${authUserId}
      `;
      if (legacy.length > 0) {
        const legacyIds = legacy.map((r) => r.id);
        console.log(
          `↪ Found ${legacy.length} legacy users row(s) for ${args.email}; migrating to ${authUserId}`,
        );

        // Free the email so we can insert the new row with the correct email.
        await tx`
          UPDATE users
             SET email = email || '.legacy.' || id::text
           WHERE id = ANY (${legacyIds}::uuid[])
        `;

        // Insert (or upsert) the new users row at the auth UUID FIRST so the
        // restrict-FK in memberships.user_id can be repointed safely.
        await tx`
          INSERT INTO users (id, email, full_name, status)
          VALUES (${authUserId}, ${args.email}, ${args.name ?? null}, 'active')
          ON CONFLICT (id) DO UPDATE
            SET email      = EXCLUDED.email,
                full_name  = COALESCE(EXCLUDED.full_name, users.full_name),
                status     = 'active',
                updated_at = now()
        `;

        // Repoint memberships, skipping rows that would duplicate an existing
        // (org_id, user_id) under the auth UUID.
        await tx`
          UPDATE memberships
             SET user_id = ${authUserId}, updated_at = now()
           WHERE user_id = ANY (${legacyIds}::uuid[])
             AND NOT EXISTS (
               SELECT 1 FROM memberships m2
                WHERE m2.user_id = ${authUserId}
                  AND m2.organization_id = memberships.organization_id
             )
        `;

        // Repoint workforce.employees.user_id (set-null FK; safe to update).
        await tx`
          UPDATE employees
             SET user_id = ${authUserId}
           WHERE user_id = ANY (${legacyIds}::uuid[])
        `;

        // Any leftover memberships on a legacy id (duplicates) get cleaned.
        await tx`
          DELETE FROM memberships WHERE user_id = ANY (${legacyIds}::uuid[])
        `;

        // Now safe to delete the legacy users rows (memberships cleared,
        // cascade FKs auto-clean preferences/notifications/etc).
        await tx`
          DELETE FROM users WHERE id = ANY (${legacyIds}::uuid[])
        `;
        console.log('✔ Legacy users row(s) migrated and removed');
      }

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

      // ─── 5. Optional customer-org membership + role ──────────────────────
      // Ensures the user can sign in and immediately land in a working
      // organization (avoids the "no orgs" empty state after a fresh
      // Supabase Auth login on the deployed environment).
      if (args.customerOrg) {
        const roleKey = args.customerRole ?? 'owner';

        const membershipRows = await tx<{ id: string }[]>`
          INSERT INTO memberships (organization_id, user_id, status, created_by, updated_by)
          VALUES (${args.customerOrg}, ${authUserId}, 'active', ${authUserId}, ${authUserId})
          ON CONFLICT (organization_id, user_id) DO UPDATE
            SET status     = 'active',
                updated_at = now(),
                updated_by = ${authUserId}
          RETURNING id
        `;
        const membershipId = membershipRows[0]!.id;
        console.log(
          `✔ membership upserted in org ${args.customerOrg} (id=${membershipId})`,
        );

        const roleRows = await tx<{ id: string; name: string }[]>`
          SELECT id, name FROM roles
           WHERE organization_id = ${args.customerOrg}
             AND key             = ${roleKey}
             AND deleted_at IS NULL
           LIMIT 1
        `;
        const role = roleRows[0];
        if (!role) {
          throw new Error(
            `Role with key='${roleKey}' not found in organization ${args.customerOrg}. ` +
              `Ensure the org's standard roles have been seeded.`,
          );
        }

        // Idempotent role assignment: skip if an active (non-revoked, org-wide,
        // non-expired) assignment for this role already exists.
        const existingAssign = await tx<{ id: string }[]>`
          SELECT id FROM role_assignments
           WHERE organization_id = ${args.customerOrg}
             AND membership_id   = ${membershipId}
             AND role_id         = ${role.id}
             AND workshop_id IS NULL
             AND department_id IS NULL
             AND (valid_until IS NULL OR valid_until > now())
             AND deleted_at IS NULL
           LIMIT 1
        `;
        if (existingAssign.length === 0) {
          await tx`
            INSERT INTO role_assignments
              (organization_id, membership_id, role_id, assigned_by_user_id, created_by, updated_by)
            VALUES
              (${args.customerOrg}, ${membershipId}, ${role.id}, ${authUserId}, ${authUserId}, ${authUserId})
          `;
          console.log(`✔ ${role.name} role granted in customer org`);
        } else {
          console.log(`✔ ${role.name} role already active in customer org`);
        }
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
