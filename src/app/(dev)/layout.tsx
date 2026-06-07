import { type ReactNode } from 'react';

import { requirePlatformAccess } from '@/lib/platform/guard';

/**
 * Hardened layout for the entire `/dev` route group (Developer Control Plane).
 *
 * Every `/dev` PAGE renders through this layout, so platform access is enforced
 * uniformly: non-platform users get a 404 (the surface is not acknowledged).
 *
 * NOTE: route handlers (e.g. /dev/health/route.ts) are NOT wrapped by layouts;
 * /dev/health stays intentionally open as the deploy health check.
 */
export default async function DevLayout({ children }: { children: ReactNode }) {
  await requirePlatformAccess();
  return <div className="min-h-screen bg-background">{children}</div>;
}
