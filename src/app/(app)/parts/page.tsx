import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  listOpenRequirements,
  listSupplierInvoices,
  listSuppliers,
} from '@/modules/parts/public';

import { InvoicesPanel } from './invoices-panel';

export const dynamic = 'force-dynamic';

/**
 * /parts — purchasing coordinator surface (Sprint 11 + Sprint 14 Track F).
 * Open cross-case requirements plus the supplier-invoices drawer. Invoice
 * registration / booking / crediting happen in a right-side drawer; case
 * traceability is preserved on every line.
 */
export default async function PartsCoordinatorPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [open, invoices, suppliers] = await Promise.all([
    listOpenRequirements(session.context),
    listSupplierInvoices(session.context),
    listSuppliers(session.context),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.parts.coordinatorTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.parts.openRequirementsDescription}
        </p>
      </header>

      <section className="rounded-lg border bg-background shadow-sm">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t.parts.openRequirements} ({open.length})
          </h2>
        </header>
        {open.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t.parts.nothingOpen}
          </p>
        ) : (
          <ul className="divide-y">
            {open.map(({ requirement, caseNumber }) => (
              <li
                key={requirement.id}
                className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{requirement.description}</span>
                  {requirement.partNumber ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {requirement.partNumber}
                    </span>
                  ) : null}
                </div>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {requirement.status}
                  </span>
                  <Link
                    href={`/cases/${requirement.caseId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {caseNumber}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvoicesPanel
        invoices={invoices.map((i) => ({
          id: i.invoice.id,
          invoiceNumber: i.invoice.invoiceNumber,
          supplierName: i.supplierName,
          invoiceDate: i.invoice.invoiceDate.toISOString(),
          totalGross: i.invoice.totalGross,
          status: i.invoice.status,
          currency: i.invoice.currency,
          lineCount: i.lineCount,
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        labels={{
          invoices: t.parts.invoices,
          invoicesDescription: t.parts.invoicesDescription,
          invoicesEmpty: t.parts.invoicesEmpty,
          receiveInvoice: t.parts.receiveInvoice,
          invoiceNumber: t.parts.invoiceNumber,
          invoiceSupplier: t.parts.invoiceSupplier,
          invoiceDate: t.parts.invoiceDate,
          invoiceDueDate: t.parts.invoiceDueDate,
          invoiceTotal: t.parts.invoiceTotal,
          invoiceMatch: t.parts.invoiceMatch,
          invoiceAddLine: t.parts.invoiceAddLine,
          invoiceQty: t.parts.invoiceQty,
          invoiceLineCase: t.parts.invoiceLineCase,
          invoiceLineDescription: t.parts.invoiceLineDescription,
          invoiceUnitPrice: t.parts.invoiceUnitPrice,
          cancel: t.case.panelCancel,
          confirm: t.case.panelConfirm,
          book: t.parts.invoiceMatched,
        }}
      />
    </div>
  );
}
