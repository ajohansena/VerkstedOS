import Link from 'next/link';

import { formatDate, type Locale } from '@/lib/i18n';

import { CaseStatusDrawer } from './case-status-drawer';

interface FundingLite {
  id: string;
  kind: string;
  label?: string | null;
  status: string;
}

interface SidePanelLabels {
  state: string;
  vehicle: string;
  customer: string;
  openedDays: string; // 'Åpen i {days} d'
  eta: string;
  tech: string;
  funding: string;
  fundingEmpty: string;
  quickActions: string;
  changeStatus: string;
  estimate: string;
  cancel: string;
  confirm: string;
  reason: string;
  reasonOptional: string;
  newStatus: string;
  noState: string;
  noTech: string;
}

/**
 * Case Workspace → sticky right side panel (doc 12 §6). Holds the
 * always-visible operational summary plus quick actions. Server component;
 * the only interactive bits (status drawer) are extracted to their own client
 * component.
 */
export function CaseSidePanel({
  caseId,
  caseNumber,
  openedAt,
  stateLabel,
  vehicleSummary,
  registrationNumber,
  customerName,
  assignedTechName,
  etaDate,
  funding,
  availableTransitions,
  locale,
  labels,
}: {
  caseId: string;
  caseNumber: string;
  openedAt: Date;
  stateLabel: string | null;
  vehicleSummary: string | null;
  registrationNumber: string | null;
  customerName: string | null;
  assignedTechName: string | null;
  etaDate: Date | null;
  funding: FundingLite[];
  availableTransitions: { id: string; code: string; label: string }[];
  locale: Locale;
  labels: SidePanelLabels;
}) {
  const ageDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(openedAt).getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
  return (
    <aside className="sticky top-20 space-y-4 self-start rounded-lg border bg-background p-4 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {caseNumber}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold">
            {stateLabel ?? labels.noState}
          </span>
        </div>
      </div>

      <SectionRow label={labels.openedDays.replace('{days}', String(ageDays))}>
        {etaDate ? (
          <div className="text-xs text-muted-foreground">
            {labels.eta}: {formatDate(etaDate, locale)}
          </div>
        ) : null}
      </SectionRow>

      <Section title={labels.vehicle}>
        {registrationNumber ? (
          <div className="font-mono text-xs uppercase tracking-wide">
            {registrationNumber}
          </div>
        ) : null}
        <div className="text-sm">{vehicleSummary ?? '—'}</div>
      </Section>

      <Section title={labels.customer}>
        <div className="text-sm">{customerName ?? '—'}</div>
      </Section>

      <Section title={labels.tech}>
        <div className="text-sm">{assignedTechName ?? labels.noTech}</div>
      </Section>

      <Section title={labels.funding}>
        {funding.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {labels.fundingEmpty}
          </div>
        ) : (
          <ul className="space-y-1">
            {funding.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-xs"
              >
                <span className="truncate font-medium">
                  {f.label ?? f.kind}
                </span>
                <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">
                  {f.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={labels.quickActions}>
        <div className="space-y-2">
          <CaseStatusDrawer
            caseId={caseId}
            available={availableTransitions}
            labels={{
              changeStatus: labels.changeStatus,
              cancel: labels.cancel,
              confirm: labels.confirm,
              reason: labels.reason,
              reasonOptional: labels.reasonOptional,
              newStatus: labels.newStatus,
            }}
          />
          <Link
            href={`/cases/${caseId}/estimate`}
            className="inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted/40"
          >
            {labels.estimate}
          </Link>
        </div>
      </Section>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function SectionRow({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}
