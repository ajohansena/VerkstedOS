import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { getSessionContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Minimal embed layout (doc 13 §7) — used when a canonical surface is opened
 * inside an iframe drawer (e.g. clicking a card on the Production Board opens
 * the Case Workspace as a right-side drawer over the board). No sidebar, no
 * topbar — just the page body so the drawer chrome stays clean. Session check
 * still runs so an unauthenticated iframe redirects to /login.
 */
export default async function EmbedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }
  return <div className="min-h-screen bg-background p-4">{children}</div>;
}
