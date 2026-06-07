import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped tenant context (docs/05-multi-tenant-and-rbac.md).
 *
 * Resolved once per request from the authenticated user's memberships and the
 * selected organization, then stashed in AsyncLocalStorage so any service or
 * repository can read it without threading it through every signature. The
 * tenant-aware Drizzle client reads it to set `SET LOCAL app.current_org_id`
 * (and friends) at transaction start.
 */
export interface RequestContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workshopId: string | null;
  /** All workshops in the active org the user may access (org-wide for now). */
  readonly accessibleWorkshopIds: readonly string[];
  /** Correlation id for tracing a request across events and audit rows. */
  readonly correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with the given tenant context bound for its async lifetime. */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

/** Read the current context, or `undefined` if running outside a request. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Read the current context, throwing if absent. */
export function requireContext(): RequestContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      'No tenant context. Code must run inside runWithContext(...) — a query ' +
        'was attempted without an organization context.',
    );
  }
  return context;
}
