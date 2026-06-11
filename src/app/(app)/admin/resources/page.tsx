import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getCurrentOrganization,
  listWorkshops,
} from '@/modules/identity/public';
import { listEmployees, listResources } from '@/modules/workforce/public';

import { CreateResourceForm } from './create-resource-form';
import { ResourceRowActions } from './resource-row-actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/resources — capacity-planning Resource CRUD (Sprint 22 Phase C,
 * doc 10 § Resource model). Resources are the SSoT for planner capacity:
 * person resources (auto-created from employees in Phase B), equipment and
 * facilities (e.g. paint booths, frame benches, ADAS rigs).
 *
 * Person resources are read-only here regarding workshop ownership — they
 * inherit their employee's workshop and move with the employee (one logical
 * entity rule). Equipment + facility resources are fully editable here.
 */
export default async function AdminResourcesPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [resources, employees, workshops] = await Promise.all([
    listResources(auth.session.context),
    listEmployees(auth.session.context),
    listWorkshops(auth.session.context),
  ]);

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const workshopOptions = workshops.map((w) => ({ id: w.id, name: w.name }));

  const grouped = {
    person: resources.filter((r) => r.kind === 'person'),
    equipment: resources.filter((r) => r.kind === 'equipment'),
    facility: resources.filter((r) => r.kind === 'facility'),
  };

  const rowLabels = {
    statusActive: t.resource.statusActive,
    statusInactive: t.resource.statusInactive,
    statusMaintenance: t.resource.statusMaintenance,
    sharedAcrossOrg: t.resource.sharedAcrossOrg,
    saveStatus: t.resource.saveStatus,
    saveWorkshop: t.resource.saveWorkshop,
    archive: t.resource.archive,
    archiveConfirm: t.resource.archiveConfirm,
    personLocked: t.resource.personLocked,
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.resource.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.resource.description}
          </p>
        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {t.common.back}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.resource.createHeading}</CardTitle>
          <CardDescription>{t.resource.createDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateResourceForm
            workshops={workshopOptions}
            labels={{
              heading: t.resource.createHeading,
              name: t.resource.fieldName,
              kind: t.resource.fieldKind,
              kindEquipment: t.resource.kindEquipment,
              kindFacility: t.resource.kindFacility,
              workshop: t.resource.fieldWorkshop,
              sharedAcrossOrg: t.resource.sharedAcrossOrg,
              submit: t.resource.submit,
              personHint: t.resource.personHint,
            }}
          />
        </CardContent>
      </Card>

      {(['person', 'equipment', 'facility'] as const).map((kind) => {
        const items = grouped[kind];
        const heading =
          kind === 'person'
            ? t.resource.headingPeople
            : kind === 'equipment'
              ? t.resource.headingEquipment
              : t.resource.headingFacilities;
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-base">
                {heading} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.resource.emptyForKind}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-4">{t.resource.columnName}</th>
                        <th className="py-2 pr-4">
                          {t.resource.columnWorkshop}
                        </th>
                        {kind === 'person' ? (
                          <th className="py-2 pr-4">
                            {t.resource.columnEmployee}
                          </th>
                        ) : null}
                        <th className="py-2 pr-4">{t.resource.columnStatus}</th>
                        <th className="py-2 pr-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => {
                        const employee = r.employeeId
                          ? employeesById.get(r.employeeId)
                          : null;
                        const workshop = r.workshopId
                          ? workshopsById.get(r.workshopId)
                          : null;
                        return (
                          <tr key={r.id} className="border-b align-top">
                            <td className="py-2 pr-4 font-medium">{r.name}</td>
                            <td className="py-2 pr-4 text-xs">
                              {workshop?.name ?? t.resource.sharedAcrossOrg}
                            </td>
                            {kind === 'person' ? (
                              <td className="py-2 pr-4 text-xs">
                                {employee?.fullName ?? '—'}
                              </td>
                            ) : null}
                            <td className="py-2 pr-4">
                              <span className="text-xs uppercase text-muted-foreground">
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <ResourceRowActions
                                resourceId={r.id}
                                kind={r.kind}
                                currentStatus={r.status}
                                currentWorkshopId={r.workshopId}
                                workshops={workshopOptions}
                                labels={rowLabels}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
