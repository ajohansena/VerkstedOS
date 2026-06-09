import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listPendingAbsenceRequests } from '@/modules/workforce/public';

import {
  approveAbsenceAction,
  declineAbsenceAction,
} from '../../absence/actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/absence — Approval queue for HR/admin (Sprint 18). Server actions
 * guarded by `admin:config` permission.
 */
export default async function AdminAbsencePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const pending = await listPendingAbsenceRequests(session.context);
  const fmt = (d: Date): string =>
    new Intl.DateTimeFormat(locale === 'nb-NO' ? 'nb-NO' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.absence.queueTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{t.absence.description}</p>
      </header>

      <section className="rounded-lg border bg-background">
        {pending.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t.absence.queueEmpty}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {t.absence.requestEmployee}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t.absence.requestType}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t.absence.requestStart}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t.absence.requestEnd}
                </th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pending.map((a) => (
                <tr key={a.entry.id}>
                  <td className="px-4 py-2">{a.employeeName}</td>
                  <td className="px-4 py-2">{a.typeLabel}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {fmt(a.entry.startsAt)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {fmt(a.entry.endsAt)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <form action={approveAbsenceAction}>
                        <input type="hidden" name="id" value={a.entry.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-foreground bg-foreground px-3 py-1 text-xs font-medium text-background hover:opacity-90"
                        >
                          {t.absence.queueApprove}
                        </button>
                      </form>
                      <form
                        action={declineAbsenceAction}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="id" value={a.entry.id} />
                        <input
                          type="text"
                          name="reason"
                          required
                          placeholder={t.absence.queueDeclineReason}
                          className="w-40 rounded-md border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md border px-3 py-1 text-xs hover:bg-muted/50"
                        >
                          {t.absence.queueDecline}
                        </button>
                      </form>
                    </div>
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
