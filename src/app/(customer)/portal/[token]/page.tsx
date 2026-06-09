import { notFound } from 'next/navigation';

import { getDictionary } from '@/lib/i18n';
import {
  readPortalCase,
  resolvePortalToken,
  touchPortalToken,
} from '@/modules/notifications/public';

export const dynamic = 'force-dynamic';

/**
 * /portal/[token] — customer / insurer status page (Sprint 17, doc 11
 * §Customer). Token IS the credential. Renders an expired/revoked notice
 * rather than 404 when the token is known but inactive. Records first/last
 * use on every render. Norwegian by default.
 */
export default async function CustomerPortalPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const t = getDictionary('nb-NO');
  const resolved = await resolvePortalToken(token);
  if (!resolved) notFound();

  if (!resolved.active) {
    const message =
      resolved.reason === 'expired' ? t.portal.expired : t.portal.revoked;
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">{t.portal.headline}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  // Mark this use; non-blocking conceptually but we await for predictability.
  await touchPortalToken(resolved.token.id);
  const view = await readPortalCase(resolved.token.caseId);
  if (!view) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">{t.portal.headline}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t.portal.notFound}
          </p>
        </div>
      </div>
    );
  }

  const fmt = (iso: string): string =>
    new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));

  const statusLabel = view.productionStateLabel ?? view.status;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t.portal.headline}
        </h1>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Row label={t.portal.caseLabel} value={view.caseNumber} />
          <Row label={t.portal.statusLabel} value={statusLabel} />
          {view.vehicleLabel && (
            <Row
              label={t.portal.vehicleLabel}
              value={
                view.registrationNumber
                  ? `${view.vehicleLabel} (${view.registrationNumber})`
                  : view.vehicleLabel
              }
            />
          )}
          {view.workshopName && (
            <Row label={t.portal.workshopLabel} value={view.workshopName} />
          )}
          {view.expectedReadyAt && (
            <Row
              label={t.portal.expectedLabel}
              value={fmt(view.expectedReadyAt)}
            />
          )}
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          {t.portal.refreshNote}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
