import Link from 'next/link';
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
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dev" className="text-sm font-semibold tracking-tight">
            VerkstedOS · Developer Control Plane
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/dev/orgs" className="hover:text-foreground">
              Orgs
            </Link>
            <Link href="/dev/workshops" className="hover:text-foreground">
              Workshops
            </Link>
            <Link href="/dev/users" className="hover:text-foreground">
              Users
            </Link>
            <Link href="/dev/dashboards" className="hover:text-foreground">
              Dashboards
            </Link>
            <Link href="/dev/audit" className="hover:text-foreground">
              Audit
            </Link>
            <Link href="/dev/events/failed" className="hover:text-foreground">
              Failed events
            </Link>
            <Link href="/dev/two-person" className="hover:text-foreground">
              2-person queue
            </Link>
            <Link href="/dev/health" className="hover:text-foreground">
              Health
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
