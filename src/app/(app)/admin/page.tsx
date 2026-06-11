import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import {
  getCurrentOrganization,
  listWorkshops,
} from '@/modules/identity/public';

import { OrgSettingsForm } from './org-settings-form';

export const dynamic = 'force-dynamic';

/**
 * /admin — actionable admin home (Sprint 14 Track G). Org settings and
 * workshops are now editable inline (gated by `admin:config`). Links out to
 * users, roles, suppliers, checklists, employees, and the workflow editor.
 */
export default async function AdminPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  const session = auth.session;
  const [canManageUsers, canConfig] = await Promise.all([
    auth.can('admin:users'),
    auth.can('admin:config'),
  ]);

  const [organization, workshops] = await Promise.all([
    getCurrentOrganization(session.context),
    listWorkshops(session.context),
  ]);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const settings = (organization?.settings ?? {}) as Record<string, unknown>;
  const caseFormat =
    typeof settings['caseNumberFormat'] === 'string'
      ? (settings['caseNumberFormat'] as string)
      : '';

  const links: { href: string; label: string; show: boolean }[] = [
    { href: '/admin/users', label: t.admin.users, show: canManageUsers },
    { href: '/admin/roles', label: t.admin.roles, show: canManageUsers },
    { href: '/admin/suppliers', label: t.admin.suppliers, show: true },
    { href: '/admin/checklists', label: t.admin.checklists, show: true },
    { href: '/admin/employees', label: t.admin.employees, show: true },
    { href: '/admin/workflow', label: t.admin.workflow, show: true },
    {
      href: '/admin/notifications',
      label: t.admin.notifications,
      show: canConfig,
    },
    {
      href: '/admin/booking-policy',
      label: t.admin.bookingPolicy,
      show: canConfig,
    },
    {
      href: '/admin/office-tasks',
      label: t.admin.officeTasks,
      show: canConfig,
    },
    {
      href: '/admin/task-templates',
      label: t.admin.taskTemplates,
      show: canConfig,
    },
    { href: '/admin/absence', label: t.absence.queueTitle, show: canConfig },
    { href: '/admin/rental', label: t.rental.fleetTitle, show: canConfig },
    { href: '/admin/yard', label: t.yard.designerTitle, show: canConfig },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.admin.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.admin.description}</p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted/40"
            >
              {l.label}
            </Link>
          ))}
      </nav>

      {canConfig ? (
        <OrgSettingsForm
          initialName={organization?.name ?? ''}
          initialOrgNumber={organization?.orgNumber ?? ''}
          initialLocale={locale}
          initialCaseFormat={caseFormat}
          labels={{
            organization: t.admin.organization,
            organizationName: t.admin.organizationName,
            organizationNumber: t.admin.organizationNumber,
            settingsLocale: t.admin.settingsLocale,
            settingsCaseFormat: t.admin.settingsCaseFormat,
            save: t.admin.save,
            saved: t.admin.saved,
            workshops: t.admin.workshops,
            addWorkshop: t.admin.addWorkshop,
            workshopName: t.admin.workshopName,
          }}
        />
      ) : null}

      <section className="rounded-lg border bg-background shadow-sm">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t.admin.workshops} ({workshops.length})
          </h2>
        </header>
        {workshops.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="divide-y">
            {workshops.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {w.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
