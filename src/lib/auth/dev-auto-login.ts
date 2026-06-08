/**
 * ⚠️  TEMPORARY DEVELOPMENT-ONLY AUTH BYPASS  ⚠️
 *
 * When `DEV_AUTO_LOGIN_EMAIL` is set AND `NODE_ENV !== 'production'`,
 * `getSessionContext()` and `requirePlatformAccess()` short-circuit Supabase
 * Auth and impersonate the user whose row in the local `users` table matches
 * the email. No password, no cookie, no Supabase session — purely a server-side
 * identity injection.
 *
 * This file exists for ONE reason: to let the project owner inspect the UI
 * built through Sprint 13 without fighting Supabase Auth / Codespaces /
 * Server Action origin issues. Delete this file and remove the two call-sites
 * once the normal Supabase login flow is verified end-to-end.
 *
 * Hard guards:
 *   - Returns `null` immediately if `process.env.NODE_ENV === 'production'`.
 *   - Returns `null` if `DEV_AUTO_LOGIN_EMAIL` is unset / empty.
 *   - Logs a loud banner on every bypassed request.
 */

import { findUserByEmail } from '@/modules/identity/public';

export const DEV_AUTO_LOGIN_ENV = 'DEV_AUTO_LOGIN_EMAIL';

let warned = false;
function warnOnce(email: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `\n⚠️  DEV AUTH BYPASS ACTIVE — every request is authenticated as ${email}.\n` +
      `   This must NEVER ship to production. NODE_ENV=${process.env.NODE_ENV}\n`,
  );
}

export interface DevAutoLoginUser {
  id: string;
  email: string;
  fullName: string | null;
}

/**
 * Returns the auto-login user if the bypass is active, otherwise `null`.
 * Safe to call from anywhere — production builds always return `null`.
 */
export async function getDevAutoLoginUser(): Promise<DevAutoLoginUser | null> {
  if (process.env.NODE_ENV === 'production') return null;

  const email = process.env[DEV_AUTO_LOGIN_ENV]?.trim().toLowerCase();
  if (!email) return null;

  const user = await findUserByEmail(email);
  if (!user) {
    console.error(
      `[dev-auth-bypass] DEV_AUTO_LOGIN_EMAIL=${email} but no users row found. ` +
        `Run pnpm bootstrap:owner first, or unset the env var.`,
    );
    return null;
  }

  warnOnce(email);
  return { id: user.id, email: user.email, fullName: user.fullName };
}
