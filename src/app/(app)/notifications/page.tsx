import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listMyNotifications } from '@/modules/notifications/public';

import { dismiss, markAllRead, markRead } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /notifications — the user's inbox of triggered alerts (doc 11 §All roles;
 * doc 13 §10). Read, mark-as-read, dismiss. The bell in the topbar links here.
 */
export default async function NotificationsPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const items = await listMyNotifications(session.context, { limit: 100 });
  const titleFor = (code: string | null): string => {
    if (!code) return t.notifications.titleOther;
    const key = `title${code.charAt(0).toUpperCase()}${code.slice(1)}` as
      | keyof typeof t.notifications;
    const val = t.notifications[key];
    return typeof val === 'string' ? val : t.notifications.titleOther;
  };
  const sevLabel = (s: string): string =>
    s === 'critical'
      ? t.notifications.severityCritical
      : s === 'warning'
        ? t.notifications.severityWarning
        : t.notifications.severityInfo;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.notifications.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.notifications.description}
          </p>
        </div>
        {items.some((n) => n.status === 'unread') && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              {t.notifications.markAllRead}
            </button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
          {t.notifications.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 rounded-lg border bg-background p-3 ${
                n.status === 'unread' ? 'border-l-4 border-l-amber-500' : ''
              }`}
            >
              <div
                className={`mt-1 inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  n.severity === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : n.severity === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-sky-100 text-sky-700'
                }`}
              >
                {sevLabel(n.severity)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{titleFor(n.ruleCode)}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {n.actionUrl && (
                  <Link
                    href={n.actionUrl}
                    className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    {t.notifications.open}
                  </Link>
                )}
                {n.status === 'unread' && (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
                    >
                      {t.notifications.markRead}
                    </button>
                  </form>
                )}
                <form action={dismiss}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    {t.notifications.dismiss}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
