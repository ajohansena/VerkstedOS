import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';

export const dynamic = 'force-dynamic';

/**
 * /dashboard — role auto-routing (docs/11 §1: the role determines the
 * dashboard, not a menu). Owners (who can view finance) land on the Workshop
 * Owner dashboard; users who can edit cases (estimators) on the Estimator
 * dashboard; everyone else on the Production Manager dashboard.
 */
export default async function DashboardIndexPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (await auth.can('finance:view')) {
    redirect('/dashboard/owner');
  }
  if (await auth.can('case:edit')) {
    redirect('/dashboard/estimator');
  }
  redirect('/dashboard/production');
}
