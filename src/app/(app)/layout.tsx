import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { AppSidebar } from '@/components/app-shell/sidebar';
import { AppTopbar } from '@/components/app-shell/topbar';
import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization, listWorkshops } from '@/modules/identity/public';
import { listRecentCases } from '@/modules/case/public';

export const dynamic = 'force-dynamic';

/**
 * Persistent application shell (doc 12 §3). Wraps every office surface in the
 * `(app)` route group so navigation is a sidebar item flip — never a page
 * remount. Single source of session/org resolution for the chrome.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const [organization, workshops, recents] = await Promise.all([
    getCurrentOrganization(session.context),
    listWorkshops(session.context),
    listRecentCases(session.context, 5),
  ]);

  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const currentWorkshopName =
    workshops.find((w) => w.id === session.context.workshopId)?.name ??
    workshops[0]?.name ??
    null;

  const sidebarLabels = {
    operations: t.nav.operations,
    production: t.nav.production,
    cases: t.nav.cases,
    parts: t.nav.parts,
    vehicles: t.nav.vehicles,
    customers: t.nav.customers,
    yard: t.nav.yard,
    insights: t.nav.insights,
    admin: t.nav.admin,
    clock: t.nav.clock,
    finance: t.nav.finance,
  };

  const topbarLabels = {
    commandPaletteHint: t.shell.commandPaletteHint,
    commandShortcut: t.shell.commandShortcut,
    signedInAs: t.shell.signedInAs,
    workshop: t.shell.workshop,
    paletteLabels: {
      placeholder: t.palette.placeholder,
      sectionRecents: t.palette.sectionRecents,
      sectionGoto: t.palette.sectionGoto,
      sectionActions: t.palette.sectionActions,
      sectionCases: t.palette.sectionCases,
      sectionVehicles: t.palette.sectionVehicles,
      sectionCustomers: t.palette.sectionCustomers,
      empty: t.palette.empty,
      actionNewCase: t.palette.actionNewCase,
      actionClockIn: t.palette.actionClockIn,
      actionInbound: t.palette.actionInbound,
      gotoOps: t.palette.gotoOps,
      gotoProduction: t.palette.gotoProduction,
      gotoCases: t.palette.gotoCases,
      gotoParts: t.palette.gotoParts,
      gotoAdmin: t.palette.gotoAdmin,
    },
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        labels={sidebarLabels}
        organization={{ name: organization?.name ?? '—' }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          labels={topbarLabels}
          user={{ email: session.user.email }}
          organizations={session.availableOrganizations}
          currentOrgId={session.context.organizationId}
          currentWorkshop={currentWorkshopName}
          recents={recents.map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            subtitle:
              [c.registrationNumber, c.customerName]
                .filter(Boolean)
                .join(' · ') || null,
          }))}
        />
        <main className="min-w-0 flex-1 bg-muted/10">{children}</main>
      </div>
    </div>
  );
}
