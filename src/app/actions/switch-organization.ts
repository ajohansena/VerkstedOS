'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ORG_COOKIE } from '@/lib/auth/session';
import { userBelongsToOrg } from '@/modules/identity/public';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Switch the active organization for a multi-org user. Validates membership
 * before setting the cookie so a user cannot select an org they don't belong to
 * (the resolver and RLS would reject it anyway — this is the friendly guard).
 */
export async function switchOrganization(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  if (!organizationId || !isSupabaseConfigured()) {
    redirect('/');
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (userId && (await userBelongsToOrg(userId, organizationId))) {
    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  redirect('/');
}
