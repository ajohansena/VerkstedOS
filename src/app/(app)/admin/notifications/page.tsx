import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listOrgNotificationRules } from '@/modules/notifications/public';

import { toggleRule } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/notifications — Notification Rules admin surface (Sprint 17, docs/05
 * §6 admin surface requirement). Permission is `admin:config` (reused — no
 * new permission per CLAUDE.md §4.3 discipline). Toggle rule.enabled and the
 * cron immediately respects it on the next 15-minute run.
 */
export default async function AdminNotificationsPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) redirect('/admin');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const rules = await listOrgNotificationRules(auth.session.context);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.admin.notificationsTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.admin.notificationsDescription}
        </p>
      </header>

      <section className="rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t.admin.notificationsRuleCode}
              </th>
              <th className="px-3 py-2 font-medium">
                {t.admin.notificationsCategory}
              </th>
              <th className="px-3 py-2 font-medium">
                {t.admin.notificationsSeverity}
              </th>
              <th className="px-3 py-2 font-medium">
                {t.admin.notificationsEnabled}
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-3 py-2 font-mono text-xs">{rule.code}</td>
                <td className="px-3 py-2">{rule.category}</td>
                <td className="px-3 py-2">{rule.severity}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      rule.enabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rule.enabled ? '✓' : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={toggleRule}>
                    <input type="hidden" name="code" value={rule.code} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={String(!rule.enabled)}
                    />
                    <button
                      type="submit"
                      className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
                    >
                      {rule.enabled
                        ? t.admin.notificationsToggleOff
                        : t.admin.notificationsToggleOn}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
