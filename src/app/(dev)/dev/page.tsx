import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { requirePlatformAccess } from '@/lib/platform/guard';
import {
  listAllOrganizations,
  outboxCounts,
  listDangerousOpsQueue,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * `/dev` — Developer Control Plane landing (Sprint 20 — Platform Maturity).
 *
 * Hardened by the `(dev)` route-group layout (platform auth + IP allow-list +
 * 404 for non-platform users). Surfaces a platform-wide overview and an index
 * into every Dev surface so platform operators have a single entry point.
 */
export default async function DevHomePage() {
  const ctx = await requirePlatformAccess();
  const configured = isSupabaseConfigured();

  const [orgs, outbox, twoPersonQueue] = configured
    ? await Promise.all([
        listAllOrganizations(),
        outboxCounts(),
        listDangerousOpsQueue({ status: 'pending_approval' }),
      ])
    : [[], { pending: 0, published: 0, failed: 0 }, []];

  const totalWorkshops = orgs.reduce((sum, o) => sum + o.workshopCount, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Developer Control Plane
        </p>
        <h1 className="text-3xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-mono">{ctx.userId}</span> ·{' '}
          {ctx.roles.join(', ')}
        </p>
      </header>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured.
        </p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStat
            label="Organizations"
            value={orgs.length}
            href="/dev/orgs"
          />
          <OverviewStat
            label="Workshops"
            value={totalWorkshops}
            href="/dev/orgs"
          />
          <OverviewStat
            label="Outbox failed"
            value={outbox.failed}
            tone={outbox.failed > 0 ? 'warn' : 'ok'}
            href="/dev/events/failed"
          />
          <OverviewStat
            label="Pending 2-person ops"
            value={twoPersonQueue.length}
            tone={twoPersonQueue.length > 0 ? 'warn' : 'ok'}
            href="/dev/two-person"
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Inspection surfaces</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INSPECTION_SURFACES.map((s) => (
            <SurfaceCard key={s.href} {...s} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Operations & controls</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROL_SURFACES.map((s) => (
            <SurfaceCard key={s.href} {...s} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Diagnostics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIAGNOSTIC_SURFACES.map((s) => (
            <SurfaceCard key={s.href} {...s} />
          ))}
        </div>
      </section>
    </main>
  );
}

interface SurfaceLink {
  readonly href: string;
  readonly title: string;
  readonly description: string;
}

const INSPECTION_SURFACES: readonly SurfaceLink[] = [
  {
    href: '/dev/orgs',
    title: 'Organizations',
    description: 'List, inspect and (Sprint 20) manage customer organizations.',
  },
  {
    href: '/dev/workshops',
    title: 'Workshops',
    description: 'Cross-org workshop list with member counts.',
  },
  {
    href: '/dev/users',
    title: 'Users',
    description: 'Cross-org user inspection and platform-user management.',
  },
  {
    href: '/dev/dashboards',
    title: 'Dashboards',
    description: 'KPI snapshot freshness per org.',
  },
  {
    href: '/dev/inspect',
    title: 'Entity inspector',
    description: 'Look up any entity by id (cases, documents, parts, …).',
  },
  {
    href: '/dev/documents',
    title: 'Documents',
    description: 'Storage-backed documents per org with retention status.',
  },
  {
    href: '/dev/quality',
    title: 'Quality',
    description: 'QC checklists, runs and signatures across orgs.',
  },
  {
    href: '/dev/parts',
    title: 'Parts & reconciliation',
    description: 'Part requirements, lifecycle and rebuild controls.',
  },
  {
    href: '/dev/production',
    title: 'Production',
    description: 'Segments, capacity and actuals across orgs.',
  },
  {
    href: '/dev/workforce',
    title: 'Workforce',
    description: 'Open time sessions and audit corrections.',
  },
  {
    href: '/dev/transfers',
    title: 'Transfers',
    description: 'Inter-workshop case transfers and stuck-transfer repair.',
  },
  {
    href: '/dev/communication',
    title: 'Communication',
    description: 'Customer acceptances and queued outbound messages.',
  },
  {
    href: '/dev/notifications',
    title: 'Notifications',
    description: 'Rules, deliveries and queue per org.',
  },
  {
    href: '/dev/rental',
    title: 'Rental & yard',
    description: 'Rental vehicles, reservations, agreements, yard placement.',
  },
];

const CONTROL_SURFACES: readonly SurfaceLink[] = [
  {
    href: '/dev/two-person',
    title: 'Two-person approval queue',
    description: 'Dangerous platform operations awaiting approval / execution.',
  },
  {
    href: '/dev/feature-flags',
    title: 'Feature flags',
    description: 'Per-org enablement of feature flags.',
  },
  {
    href: '/dev/impersonation',
    title: 'Impersonation',
    description: 'Start/end audited impersonation of customer users.',
  },
  {
    href: '/dev/ai/models',
    title: 'AI model registry',
    description: 'Register and toggle AI model versions.',
  },
  {
    href: '/dev/ai/predictions',
    title: 'AI predictions',
    description: 'Inspect recent AI prediction logs.',
  },
  {
    href: '/dev/integrations/dbs',
    title: 'DBS inbox',
    description: 'Imported estimate documents and import status.',
  },
];

const DIAGNOSTIC_SURFACES: readonly SurfaceLink[] = [
  {
    href: '/dev/audit',
    title: 'Platform audit log',
    description: 'Searchable platform-level audit events.',
  },
  {
    href: '/dev/events/outbox',
    title: 'Event outbox',
    description: 'Pending and recent outbox events.',
  },
  {
    href: '/dev/events/failed',
    title: 'Failed events',
    description: 'Events that failed delivery; replayable.',
  },
  {
    href: '/dev/health',
    title: 'Health check',
    description: 'JSON liveness / readiness endpoint (open).',
  },
  {
    href: '/dev/yard',
    title: 'Yard inspection',
    description: 'Yard layouts, locations, placements and movements.',
  },
];

interface OverviewStatProps {
  readonly label: string;
  readonly value: number;
  readonly href?: string;
  readonly tone?: 'ok' | 'warn';
}

function OverviewStat({ label, value, href, tone = 'ok' }: OverviewStatProps) {
  const body = (
    <Card className={tone === 'warn' ? 'border-amber-500' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

function SurfaceCard({ href, title, description }: SurfaceLink) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-accent/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{href}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
