import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import {
  ensureDefaultAbsenceTypes,
  listAbsencesInRange,
  listAbsenceTypesForOrg,
  listEmployees,
} from '@/modules/workforce/public';
import { getCurrentOrganization } from '@/modules/identity/public';

import { AbsenceRequestForm } from './request-form';
import { submitAbsenceRequest, cancelAbsenceAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /absence — Calendar of approved/requested absences for the next 30 days,
 * plus a quick "request absence" form (Sprint 18). Permission gating is on
 * the underlying actions (`time:self`).
 */
export default async function AbsencePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  await ensureDefaultAbsenceTypes(session.context);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 30 * 86400000);

  const [absences, employees, types] = await Promise.all([
    listAbsencesInRange(session.context, start, end),
    listEmployees(session.context),
    listAbsenceTypesForOrg(session.context),
  ]);

  const fmtDate = (d: Date): string =>
    new Intl.DateTimeFormat(locale === 'nb-NO' ? 'nb-NO' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);

  const statusLabel = (s: string): string => {
    switch (s) {
      case 'requested':
        return t.absence.statusRequested;
      case 'approved':
        return t.absence.statusApproved;
      case 'declined':
        return t.absence.statusDeclined;
      case 'cancelled':
        return t.absence.statusCancelled;
      default:
        return s;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.absence.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.absence.description}
        </p>
      </header>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.absence.requestTitle}
        </h2>
        <AbsenceRequestForm
          action={submitAbsenceRequest}
          employees={employees.map((e) => ({ id: e.id, displayName: e.fullName }))}
          types={types.map((tt) => ({ id: tt.id, label: tt.label }))}
          labels={{
            employee: t.absence.requestEmployee,
            type: t.absence.requestType,
            start: t.absence.requestStart,
            end: t.absence.requestEnd,
            note: t.absence.requestNote,
            submit: t.absence.requestSubmit,
          }}
        />
      </section>

      <section className="rounded-lg border bg-background">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.absence.title}
          </h2>
          <span className="text-xs text-muted-foreground">
            {fmtDate(start)} – {fmtDate(end)}
          </span>
        </header>
        {absences.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t.absence.listEmpty}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t.absence.requestEmployee}</th>
                <th className="px-4 py-2 font-medium">{t.absence.requestStart}</th>
                <th className="px-4 py-2 font-medium">{t.absence.requestEnd}</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {absences.map((a) => (
                <tr key={a.entry.id}>
                  <td className="px-4 py-2">{a.employeeName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{fmtDate(a.entry.startsAt)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{fmtDate(a.entry.endsAt)}</td>
                  <td className="px-4 py-2">{statusLabel(a.entry.status)}</td>
                  <td className="px-4 py-2 text-right">
                    {a.entry.status === 'requested' || a.entry.status === 'approved' ? (
                      <form action={cancelAbsenceAction}>
                        <input type="hidden" name="id" value={a.entry.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {t.absence.statusCancelled}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
