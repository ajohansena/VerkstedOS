import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IntakeWizard } from '@/components/intake/IntakeWizard';
import { getSessionContext } from '@/lib/auth/session';
import { listInsuranceCompanies } from '@/modules/case/public';
import { listWorkshops } from '@/modules/identity/public';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases/new — intake (User surface).
 *
 * The single adaptive Intake Wizard materializes customer + vehicle + case in
 * one coordinated server action (doc 12 § UX; CLAUDE.md § Three Surfaces).
 * The legacy `?legacy=1` split layout was removed in D3.
 */
export default async function NewCasePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const t = getDictionary();
  const [insuranceCompanies, workshops] = await Promise.all([
    listInsuranceCompanies(session.context),
    listWorkshops(session.context),
  ]);

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
            workshops={workshops.map((w) => ({ id: w.id, name: w.name }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
