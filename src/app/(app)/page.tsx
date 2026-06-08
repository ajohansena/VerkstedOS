import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Boxes, Clock, Plus, Truck } from 'lucide-react';

import { AttentionZone } from '@/components/ops/attention-zone';
import { FlowZone } from '@/components/ops/flow-zone';
import { PulseZone } from '@/components/ops/pulse-zone';
import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getOpsSnapshot } from '@/lib/operations/snapshot';
import { getCurrentOrganization } from '@/modules/identity/public';

export const dynamic = 'force-dynamic';

/**
 * Operations Center — the post-login landing surface (docs/12 §4).
 *
 * Role-adaptive in spirit; this Sprint 14 v1 renders the production-manager /
 * owner variant from the active org's live data (no charts). The three zones
 * (Attention / Flow / Pulse) follow doc 12 exactly: every Attention item is
 * actionable, every Pulse tile clicks through to where action happens.
 */
export default async function OperationsCenterPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const snapshot = await getOpsSnapshot(session.context);

  const hour = new Date().getHours();
  const greeting =
    hour < 11
      ? t.ops.subtitleMorning
      : hour < 17
        ? t.ops.subtitleAfternoon
        : t.ops.subtitleEvening;
  const firstName = session.user.email.split('@')[0] ?? '';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.ops.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {greeting}, {firstName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickActionLink
            href="/cases/new"
            icon={Plus}
            label={t.ops.quickIntake}
            primary
          />
          <QuickActionLink href="/clock" icon={Clock} label={t.ops.quickClock} />
          <QuickActionLink href="/yard" icon={Truck} label={t.ops.quickYard} />
          <QuickActionLink href="/parts" icon={Boxes} label={t.ops.quickParts} />
        </div>
      </header>

      <AttentionZone
        items={snapshot.attention}
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
            groups={snapshot.flow}
            labels={{ flow: t.ops.flow, flowEmpty: t.ops.flowEmpty }}
          />
        </div>
        <div className="rounded-lg border bg-background shadow-sm">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.ops.pulseWorkingNow}
            </h2>
          </header>
          {snapshot.workingNow.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="divide-y">
              {snapshot.workingNow.slice(0, 10).map((w) => (
                <li
                  key={w.employeeId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="truncate font-medium">{w.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.segmentCode ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
        pulse={snapshot.pulse}
      />
    </div>
  );
}

function QuickActionLink({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ' +
        (primary
          ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-background hover:bg-muted/40')
      }
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
