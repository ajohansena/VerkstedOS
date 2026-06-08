import { cookies } from 'next/headers';

import {
  ensureUser,
  resolveRequestContext,
  type RequestContext,
} from '@/modules/identity/public';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

import { getDevAutoLoginUser } from './dev-auto-login';

/** Cookie that remembers which org a multi-org user last selected. */
export const ORG_COOKIE = 'vos_org';

export interface SessionContext {
  readonly context: RequestContext;
  readonly user: { id: string; email: string };
  readonly availableOrganizations: { id: string; name: string }[];
}

/**
 * Resolve the full session for the current request: authenticate via Supabase,
 * ensure the app `users` row, then resolve tenant context for the selected (or
 * default) organization. Returns `null` when unauthenticated or unconfigured.
 *
 * This is the app-level glue between Supabase Auth and the identity module — the
 * `resolveContext` step of the authorization pipeline (docs/05 § lifecycle).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  // ── TEMPORARY DEV-ONLY BYPASS (see src/lib/auth/dev-auto-login.ts) ────────
  const devUser = await getDevAutoLoginUser();
  let authUser: { id: string; email: string; user_metadata: Record<string, unknown> } | null = null;

  if (devUser) {
    authUser = {
      id: devUser.id,
      email: devUser.email,
      user_metadata: devUser.fullName ? { full_name: devUser.fullName } : {},
    };
  } else {
    if (!isSupabaseConfigured()) {
      return null;
    }
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u?.email) {
      return null;
    }
    authUser = { id: u.id, email: u.email, user_metadata: u.user_metadata };
  }

  await ensureUser({
    id: authUser.id,
    email: authUser.email,
    fullName:
      (typeof authUser.user_metadata['full_name'] === 'string'
        ? (authUser.user_metadata['full_name'] as string)
        : null) ?? null,
  });

  const cookieStore = await cookies();
  const selectedOrgId = cookieStore.get(ORG_COOKIE)?.value;

  const resolved = await resolveRequestContext(authUser.id, selectedOrgId);
  if (!resolved) {
    return null;
  }

  return {
    context: resolved.context,
    user: { id: authUser.id, email: authUser.email },
    availableOrganizations: resolved.availableOrganizations,
  };
}
