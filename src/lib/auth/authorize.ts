import { hasPermission, type PermissionCode } from '@/modules/identity/public';

import { getSessionContext, type SessionContext } from './session';

/**
 * Permission-aware session helpers for the presentation layer. Permissions HIDE
 * elements entirely (never grey-out) — pages call these to decide what to
 * render (docs/11 design principle 8).
 */

/** Get the session and a bound permission checker, or null if unauthenticated. */
export async function getAuthorizedSession(): Promise<{
  session: SessionContext;
  can: (permission: PermissionCode) => Promise<boolean>;
} | null> {
  const session = await getSessionContext();
  if (!session) {
    return null;
  }
  return {
    session,
    can: (permission: PermissionCode) =>
      hasPermission(session.context, permission),
  };
}
