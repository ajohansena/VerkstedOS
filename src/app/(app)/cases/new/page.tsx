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
import { IntakeWizard } from '@/components/intake/IntakeWizard';
import { getSessionContext } from '@/lib/auth/session';
import { listInsuranceCompanies } from '@/modules/case/public';
import { listRecentCustomers } from '@/modules/customer/public';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ legacy?: string }>;
}

/**
 * /cases/new — intake (User surface).
 *
 * The default is the new **Intake Wizard** — a single adaptive 5-step
 * experience that materializes customer + vehicle + case in one coordinated
 * server action. The legacy split layout ("Search" + "Advanced" form) is kept
 * behind `?legacy=1` as a transitional safety net and will be removed in D3.
 *
 * Doc reference: CLAUDE.md § Database First / No Cleverness / Three Surfaces;
 * docs/12-ux-architecture.md (no edit-mode friction, case-centric).
 */
export default async function NewCasePage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const params = await searchParams;
  const useLegacy = params.legacy === '1';

  const t = getDictionary();

  if (useLegacy) {
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

  // ─────────────── New default: the Intake Wizard ────────────────────────
  const insuranceCompanies = await listInsuranceCompanies(session.context);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
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
        <CardContent className="pt-6">
          <IntakeWizard
            labels={t.intakeWizard}
            insuranceCompanies={insuranceCompanies}
            legacyHref="/cases/new?legacy=1"
          />
        </CardContent>
      </Card>
    </main>
  );
}
