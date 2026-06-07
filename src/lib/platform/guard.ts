import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

import { resolvePlatformContext, type PlatformContext } from './auth';

/**
 * Hardened `/dev` access guard (docs/06-developer-control-plane.md).
 *
 * Order:
 *   1. IP allow-list (production only, when PLATFORM_ALLOWED_IPS is set).
 *   2. Supabase authentication.
 *   3. Active `platform_users` row → otherwise 404 (we do NOT acknowledge the
 *      surface exists to non-platform users).
 *
 * Returns the platform context for authorized callers. Used by the `(dev)`
 * route-group layout so every `/dev` page is guarded uniformly.
 */
export async function requirePlatformAccess(): Promise<PlatformContext> {
  // 1. IP allow-list (enforced only when configured — i.e. production).
  const allowList = (process.env.PLATFORM_ALLOWED_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowList.length > 0) {
    const hdrs = await headers();
    const forwarded = hdrs.get('x-forwarded-for') ?? '';
    const clientIp = forwarded.split(',')[0]?.trim() ?? '';
    if (!allowList.includes(clientIp)) {
      notFound();
    }
  }

  // 2. Authentication.
  if (!isSupabaseConfigured()) {
    notFound();
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) {
    notFound();
  }

  // 3. Platform membership.
  const platform = await resolvePlatformContext(userId);
  if (!platform) {
    notFound();
  }

  return platform;
}
