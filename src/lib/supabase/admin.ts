import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client (Sprint 20 — Platform Maturity).
 *
 * Used for platform-level operations that must create or modify Supabase Auth
 * users WITHOUT going through a user-scoped session — specifically the org-
 * provisioning wizard (`/dev/orgs/new`) and the customer Owner invite flow
 * (`/admin/users/invite`).
 *
 * Service-role bypasses RLS by design. Never expose this client to user
 * input directly — always wrap calls behind a service that performs its own
 * authorisation checks (PlatformOwner / `admin:users` etc.).
 */

let cached: SupabaseClient | null = null;

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  cached = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export interface InviteUserResult {
  readonly userId: string;
  readonly email: string;
  readonly emailSent: boolean;
}

/**
 * Provision a new Supabase Auth user by email, sending the standard invite
 * email when SMTP is configured. Idempotent on email: if the user already
 * exists, return their id without re-inviting.
 *
 * Returns the auth user id so callers can mirror it into the app `users`
 * table via `ensureUser`.
 */
export async function inviteAuthUser(input: {
  email: string;
  fullName: string | null;
  redirectTo?: string;
}): Promise<InviteUserResult> {
  const admin = getAdminClient();
  const email = input.email.trim().toLowerCase();

  // Look up existing user first (inviteUserByEmail errors with 422 if already exists).
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users.find((u) => u.email?.toLowerCase() === email);
  if (found) {
    return { userId: found.id, email, emailSent: false };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: input.fullName ?? undefined },
    ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
  });
  if (error) {
    throw new Error(`Failed to invite ${email}: ${error.message}`);
  }
  const user = data?.user;
  if (!user) {
    throw new Error(`Failed to invite ${email}: no user returned`);
  }
  return { userId: user.id, email, emailSent: true };
}
