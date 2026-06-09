import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  listAccountingExports,
  listApprovedBases,
  tripletexConfigured,
} from '@/modules/finance/public';

import { FinancePanel } from './finance-panel';

export const dynamic = 'force-dynamic';

/**
 * /finance — the controller surface (Sprint 15). Approved invoice bases ready
 * to export, plus the immutable accounting-export log. Generation/approval of
 * a basis happens per case (Case Workspace finance section); this is the
 * cross-case "what's ready to book" + audit trail. Requires `finance:view`.
 */
export default async function FinancePage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('finance:view'))) redirect('/');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [approved, exports] = await Promise.all([
    listApprovedBases(auth.session.context),
    listAccountingExports(auth.session.context),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.finance.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.finance.description}</p>
      </header>

      <FinancePanel
        approved={approved.map((b) => ({
          id: b.id,
          basisNumber: b.basisNumber,
          payerType: b.payerType,
          kind: b.kind,
          netAmount: b.netAmount,
          vatAmount: b.vatAmount,
          grossAmount: b.grossAmount,
          currency: b.currency,
        }))}
        exports={exports.map((e) => ({
          id: e.id,
          status: e.status,
          target: e.target,
          requestedAt: e.requestedAt.toISOString(),
          externalRef: e.externalRef,
          attemptCount: e.attemptCount,
          errorMessage: e.errorMessage,
        }))}
        tripletexConfigured={tripletexConfigured()}
        labels={{
          approvedTitle: t.finance.approvedTitle,
          approvedDescription: t.finance.approvedDescription,
          approvedEmpty: t.finance.approvedEmpty,
          exportsTitle: t.finance.exportsTitle,
          exportsDescription: t.finance.exportsDescription,
          exportsEmpty: t.finance.exportsEmpty,
          exportAll: t.finance.exportAll,
          retry: t.finance.retry,
          basisNumber: t.finance.basisNumber,
          payer: t.finance.payer,
          kind: t.finance.kind,
          net: t.finance.net,
          vat: t.finance.vat,
          gross: t.finance.gross,
          status: t.finance.status,
          target: t.finance.target,
          requestedAt: t.finance.requestedAt,
          externalRef: t.finance.externalRef,
          attempts: t.finance.attempts,
          tripletexNotConfigured: t.finance.tripletexNotConfigured,
          kindStandard: t.finance.kindStandard,
          kindDeductible: t.finance.kindDeductible,
          kindInternal: t.finance.kindInternal,
          statusPending: t.finance.statusPending,
          statusSent: t.finance.statusSent,
          statusFailed: t.finance.statusFailed,
          statusAcknowledged: t.finance.statusAcknowledged,
        }}
      />
    </div>
  );
}
