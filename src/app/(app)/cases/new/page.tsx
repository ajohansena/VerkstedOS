import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createCaseAction } from '@/app/actions/case';
import { IntakeSearch } from '@/components/intake-search';
import { getSessionContext } from '@/lib/auth/session';
import { listRecentCustomers } from '@/modules/customer/public';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases/new — intake (User surface, Sprint 12 UX). Reception starts from a
 * registration number or phone number (how Norwegian workshops actually work),
 * with instant existing-customer/vehicle detection and a fast create-and-open
 * path. The original customer-dropdown form remains below as an advanced option
 * (e.g. setting an incident tag / first funding source up front).
 */
export default async function NewCasePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const t = getDictionary();
  const customers = await listRecentCustomers(session.context, 50);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.intake.title}</h1>
        <Link
          href="/cases"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {t.common.back}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.intake.title}</CardTitle>
          <CardDescription>{t.intake.searchHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <IntakeSearch
            labels={{
              searchPlaceholder: t.intake.searchPlaceholder,
              searchHint: t.intake.searchHint,
              search: t.intake.search,
              vehicles: t.intake.vehicles,
              customers: t.intake.customers,
              noResults: t.intake.noResults,
              createCase: t.intake.createCase,
              quickCreate: t.intake.quickCreate,
              regNumber: t.intake.regNumber,
              customerName: t.intake.customerName,
              customerPhone: t.intake.customerPhone,
              startCase: t.intake.startCase,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avansert</CardTitle>
          <CardDescription>
            Velg eksisterende kunde og legg til hendelse / finansieringskilde.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCaseAction} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="primaryCustomerId"
                className="text-sm font-medium"
              >
                {t.nav.customers}
              </label>
              <select
                id="primaryCustomerId"
                name="primaryCustomerId"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— {t.common.none} —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="incidentTag" className="text-sm font-medium">
                Hendelse
              </label>
              <Input
                id="incidentTag"
                name="incidentTag"
                placeholder="f.eks. Parkeringsskade"
              />
            </div>

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Finansieringskilde ({t.common.optional})
              </legend>
              <select
                name="fundingKind"
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— legg til senere —</option>
                <option value="insurance">Forsikring</option>
                <option value="private_pay">Privat</option>
                <option value="warranty">Garanti</option>
                <option value="goodwill">Kulanse</option>
                <option value="internal_rework">Internt omarbeid</option>
              </select>
              <Input
                name="fundingLabel"
                placeholder="Etikett (f.eks. Front – Fremtind)"
              />
              <select
                name="payerCustomerId"
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Betalende kunde (privat)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Forsikring krever et forsikringsselskap — legges til på
                saksiden.
              </p>
            </fieldset>

            <Button type="submit" className="w-full">
              {t.intake.createCase}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
