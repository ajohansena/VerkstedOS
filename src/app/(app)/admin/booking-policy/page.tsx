import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';

import { saveBookingPolicyAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/booking-policy — minimal admin surface for D2.
 *
 * Surfaces org-wide booking policy stored in
 * `organizations.settings.bookingPolicy`:
 *   - default booking window (days)
 *   - overbooking tolerance (% of resource capacity)
 *
 * Re-uses `admin:config` permission (no new permission added).
 */
export default async function BookingPolicyAdminPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  const canConfig = await auth.can('admin:config');
  if (!canConfig) redirect('/admin');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const settings = (organization?.settings ?? {}) as Record<string, unknown>;
  const policy =
    (settings['bookingPolicy'] as
      | {
          defaultBookingWindowDays?: number;
          overbookingTolerancePercent?: number;
        }
      | undefined) ?? {};
  const defaultWindow = policy.defaultBookingWindowDays ?? 14;
  const tolerance = policy.overbookingTolerancePercent ?? 0;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.booking.policyTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.booking.policyDescription}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.booking.policyTitle}</CardTitle>
          <CardDescription>{t.booking.policyHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              'use server';
              await saveBookingPolicyAction(formData);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="defaultBookingWindowDays"
                className="text-sm font-medium"
              >
                {t.booking.policyWindowLabel}
              </label>
              <Input
                id="defaultBookingWindowDays"
                name="defaultBookingWindowDays"
                type="number"
                min={1}
                max={365}
                defaultValue={defaultWindow}
              />
              <p className="text-xs text-muted-foreground">
                {t.booking.policyWindowHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="overbookingTolerancePercent"
                className="text-sm font-medium"
              >
                {t.booking.policyToleranceLabel}
              </label>
              <Input
                id="overbookingTolerancePercent"
                name="overbookingTolerancePercent"
                type="number"
                min={0}
                max={100}
                defaultValue={tolerance}
              />
              <p className="text-xs text-muted-foreground">
                {t.booking.policyToleranceHint}
              </p>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">{t.admin.save}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
