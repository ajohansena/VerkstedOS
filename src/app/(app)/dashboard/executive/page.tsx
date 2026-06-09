import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import {
  getCurrentOrganization,
  listWorkshops,
} from '@/modules/identity/public';
import { listLatestSnapshotsByWorkshop } from '@/modules/dashboards/public';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/executive — Chain-level executive dashboard (Sprint 20).
 *
 * Reads per-workshop snapshots from `kpi_snapshots` (rows where `workshop_id`
 * is non-null) and renders one row per workshop × four KPIs (throughput,
 * cycle time, on-time, utilization). Snapshots are computed by the
 * `computeRolling30Snapshots` service (nightly + Dev on-demand). Same metric
 * registry, same calculations as every other dashboard — SSoT (governance
 * 4.5). Gated by `finance:view` (chain executives have finance access).
 */
export default async function ExecutiveDashboardPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('finance:view'))) redirect('/dashboard/production');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [workshops, snapshots] = await Promise.all([
    listWorkshops(auth.session.context),
    listLatestSnapshotsByWorkshop(auth.session.context, 'rolling_30'),
  ]);

  // Group: workshopId → kpiCode → value
  const grid = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const wsId = s.workshopId;
    if (!wsId) continue;
    let row = grid.get(wsId);
    if (!row) {
      row = new Map();
      grid.set(wsId, row);
    }
    row.set(s.kpiCode, Number(s.value));
  }

  // Chain totals (sum throughput, weighted average for others where possible).
  const chainThroughput = workshops.reduce(
    (sum, ws) => sum + (grid.get(ws.id)?.get('throughput') ?? 0),
    0,
  );
  const avg = (code: string): number => {
    const vals = workshops
      .map((ws) => grid.get(ws.id)?.get(code))
      .filter((v): v is number => v !== undefined && Number.isFinite(v));
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const cellHealth = (
    code: string,
    value: number | undefined,
  ): 'green' | 'amber' | 'red' | 'neutral' => {
    if (value === undefined) return 'neutral';
    if (code === 'on_time_rate' || code === 'utilization') {
      if (value >= 80) return 'green';
      if (value >= 60) return 'amber';
      return 'red';
    }
    if (code === 'cycle_time') {
      if (value <= 10) return 'green';
      if (value <= 14) return 'amber';
      return 'red';
    }
    return 'neutral';
  };

  const healthClass: Record<'green' | 'amber' | 'red' | 'neutral', string> = {
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    neutral: 'text-foreground',
  };

  const hasData = grid.size > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.executive.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.executive.description}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t.executive.period}</p>
      </header>

      {!hasData ? (
        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
          {t.executive.empty}
        </div>
      ) : (
        <>
          <section className="rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 text-left">
                    {t.executive.workshopColumn}
                  </th>
                  <th className="p-3 text-right">
                    {t.executive.throughputColumn}
                  </th>
                  <th className="p-3 text-right">
                    {t.executive.cycleTimeColumn}
                  </th>
                  <th className="p-3 text-right">
                    {t.executive.onTimeColumn}
                  </th>
                  <th className="p-3 text-right">
                    {t.executive.utilizationColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {workshops.map((ws) => {
                  const row = grid.get(ws.id);
                  const tp = row?.get('throughput');
                  const ct = row?.get('cycle_time');
                  const ot = row?.get('on_time_rate');
                  const ut = row?.get('utilization');
                  return (
                    <tr key={ws.id} className="border-b last:border-b-0">
                      <td className="p-3 font-medium">{ws.name}</td>
                      <td className="p-3 text-right tabular-nums">
                        {tp ?? '—'}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${healthClass[cellHealth('cycle_time', ct)]}`}
                      >
                        {ct !== undefined ? ct.toFixed(1) : '—'}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${healthClass[cellHealth('on_time_rate', ot)]}`}
                      >
                        {ot !== undefined ? `${ot}%` : '—'}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${healthClass[cellHealth('utilization', ut)]}`}
                      >
                        {ut !== undefined ? `${ut}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 text-xs font-semibold uppercase tracking-wide">
                  <td className="p-3">{t.executive.chainTotals}</td>
                  <td className="p-3 text-right tabular-nums">
                    {chainThroughput}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {avg('cycle_time').toFixed(1)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {avg('on_time_rate')}%
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {avg('utilization')}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded border px-2 py-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              {t.executive.healthGreen}
            </span>
            <span className="inline-flex items-center gap-2 rounded border px-2 py-1">
              <span className="size-2 rounded-full bg-amber-500" />
              {t.executive.healthAmber}
            </span>
            <span className="inline-flex items-center gap-2 rounded border px-2 py-1">
              <span className="size-2 rounded-full bg-red-500" />
              {t.executive.healthRed}
            </span>
          </section>
        </>
      )}
    </div>
  );
}
