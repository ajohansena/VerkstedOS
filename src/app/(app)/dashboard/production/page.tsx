import { redirect } from 'next/navigation';

import { AttentionZone } from '@/components/ops/attention-zone';
import { FlowZone } from '@/components/ops/flow-zone';
import { PulseZone } from '@/components/ops/pulse-zone';
import { KpiTile, type KpiTileData } from '@/components/dashboards/kpi-tile';
import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getProductionManagerDashboard } from '@/lib/dashboards/composers';
import { getCurrentOrganization } from '@/modules/identity/public';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/production — Production Manager dashboard (docs/11 §Production
 * Manager). The live operational picture (Attention / Flow / Pulse) plus the
 * rolling-30 KPI tiles from the nightly snapshots.
 */
export default async function ProductionManagerDashboardPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const dash = await getProductionManagerDashboard(session.context);

  const byCode = new Map<string, KpiTileData>(
    dash.kpis.map((k) => [k.code, k]),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.dashboard.productionTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.dashboard.productionDescription}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.dashboard.kpiTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            data={byCode.get('throughput')}
            label={t.dashboard.kpiThroughput}
            href="/production"
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

      <AttentionZone
        items={dash.ops.attention}
        labels={{
          attention: t.ops.attention,
          attentionEmpty: t.ops.attentionEmpty,
          inbound: t.ops.attentionInbound,
          onHold: t.ops.attentionOnHold,
          partsBlocked: t.ops.attentionPartsBlocked,
          longOpen: t.ops.attentionLongOpen,
          pendingAcceptance: t.ops.attentionPendingAcceptance,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FlowZone
            groups={dash.ops.flow}
            labels={{ flow: t.ops.flow, flowEmpty: t.ops.flowEmpty }}
          />
        </div>
        <PulseZone
          labels={{
            pulse: t.ops.pulse,
            pulseActive: t.ops.pulseActive,
            pulseDueToday: t.ops.pulseDueToday,
            pulseAtRisk: t.ops.pulseAtRisk,
            pulseInProgress: t.ops.pulseInProgress,
            pulseWorkingNow: t.ops.pulseWorkingNow,
            pulseInbound: t.ops.pulseInbound,
            pulseOpenParts: t.ops.pulseOpenParts,
          }}
          pulse={dash.ops.pulse}
        />
      </div>
    </div>
  );
}
