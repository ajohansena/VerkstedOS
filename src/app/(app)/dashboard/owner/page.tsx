import Link from 'next/link';
import { redirect } from 'next/navigation';

import { KpiTile, type KpiTileData } from '@/components/dashboards/kpi-tile';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getWorkshopOwnerDashboard } from '@/lib/dashboards/composers';
import { getCurrentOrganization } from '@/modules/identity/public';

export const dynamic = 'force-dynamic';

const HEALTH_DOT: Record<'red' | 'yellow' | 'green', string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  green: 'bg-emerald-500',
};

/**
 * /dashboard/owner — Workshop Owner dashboard (docs/11 §Workshop Owner).
 * Health-at-a-glance tiles, the financial position (approved-to-book + export
 * status), and quality (QC failure + rework via the canonical calcs).
 * Requires `finance:view` (owner-level).
 */
export default async function WorkshopOwnerDashboardPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('finance:view'))) redirect('/dashboard/production');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const dash = await getWorkshopOwnerDashboard(auth.session.context);

  const byCode = new Map<string, KpiTileData>(
    dash.kpis.map((k) => [k.code, k]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.dashboard.ownerTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.dashboard.ownerDescription}
        </p>
      </header>

      {/* Health at a glance */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.dashboard.healthTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dash.health.map((h) => (
            <div
              key={h.code}
              className="rounded-lg border bg-background p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${HEALTH_DOT[h.health]}`}
                  aria-hidden
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {h.label}
                </span>
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {h.value}
                {h.unit === 'percent' ? ' %' : ''}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* KPI tiles */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.dashboard.kpiTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            data={byCode.get('throughput')}
            label={t.dashboard.kpiThroughput}
          />
          <KpiTile
            data={byCode.get('cycle_time')}
            label={t.dashboard.kpiCycleTime}
          />
          <KpiTile
            data={byCode.get('on_time_rate')}
            label={t.dashboard.kpiOnTimeRate}
          />
          <KpiTile
            data={byCode.get('utilization')}
            label={t.dashboard.kpiUtilization}
          />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Finance */}
        <section className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.dashboard.financeTitle}</h2>
            <Link
              href="/finance"
              className="text-xs text-primary hover:underline"
            >
              {t.dashboard.viewFinance} →
            </Link>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t.dashboard.financeApproved}
              </dt>
              <dd className="font-medium tabular-nums">
                {dash.finance.approvedCount} ·{' '}
                {dash.finance.approvedGross.toLocaleString()} kr
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t.dashboard.financeExports}
              </dt>
              <dd className="font-medium tabular-nums">
                {dash.finance.exports.acknowledged + dash.finance.exports.sent}/
                {dash.finance.exports.total}
              </dd>
            </div>
          </dl>
        </section>

        {/* Quality + attention */}
        <section className="rounded-lg border bg-background p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{t.dashboard.qualityTitle}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t.dashboard.qcFailure}</dt>
              <dd className="font-medium tabular-nums">
                {Math.round(dash.quality.qcFailureRate * 100)} %
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t.dashboard.rework}</dt>
              <dd className="font-medium tabular-nums">
                {Math.round(dash.quality.reworkRate * 100)} %
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t.dashboard.openParts}</dt>
              <dd className="font-medium tabular-nums">{dash.openParts}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t.dashboard.attention}</dt>
              <dd className="font-medium tabular-nums">
                {dash.attentionCount}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
