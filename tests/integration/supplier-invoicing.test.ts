import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Supplier invoicing integration suite (Sprint 14 Track F).
 *
 * Validates the supplier-invoice flow against real Postgres + RLS: a
 * coordinator REGISTERS an invoice spanning two cases → adds LINES carrying
 * case + funding traceability → BOOKS it → raises a CREDIT NOTE that flips the
 * invoice to credited. Asserts the stored totals and the case-level
 * attributability TakstKontroll requires.
 */
describe('supplier invoicing', () => {
  let h: IsolationHarness;
  let parts: typeof import('@/modules/parts/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let workshopId: string;
  let caseAId: string;
  let caseBId: string;
  let supplierId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    parts = await import('@/modules/parts/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000c1';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner14@example.no',
      fullName: 'Ingrid Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Invoice Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const ws = await h.admin`
      INSERT INTO workshops (organization_id, name)
      VALUES (${orgId}, 'Bergen') RETURNING id
    `;
    workshopId = ws[0]!['id'] as string;

    const a = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseAId = a.id;
    const b = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseBId = b.id;

    const supplier = await parts.createSupplier(ctx(), { name: 'Hella Norge' });
    supplierId = supplier.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId,
      accessibleWorkshopIds: [workshopId],
      correlationId: '00000000-0000-0000-0000-0000000000fc',
    };
  }

  let invoiceId: string;

  it('registers a draft invoice spanning two cases with case-traceable lines', async () => {
    const invoice = await parts.createSupplierInvoice(ctx(), {
      supplierId,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: new Date('2026-01-15'),
    });
    invoiceId = invoice.id;
    expect(invoice.status).toBe('draft');

    await parts.addInvoiceLine(ctx(), {
      supplierInvoiceId: invoiceId,
      description: 'Frontlykt H',
      quantity: 1,
      unitPriceNet: 2500,
      caseId: caseAId,
    });
    await parts.addInvoiceLine(ctx(), {
      supplierInvoiceId: invoiceId,
      description: 'Støtfanger bak',
      quantity: 2,
      unitPriceNet: 1500,
      caseId: caseBId,
    });

    const detail = await parts.findSupplierInvoice(ctx(), invoiceId);
    expect(detail).not.toBeNull();
    expect(detail!.lines.length).toBe(2);
    // Two different cases on ONE invoice (TakstKontroll traceability).
    expect(new Set(detail!.lines.map((l) => l.caseId)).size).toBe(2);
    // Total = 2500 + 2*1500 = 5500.
    expect(Number(detail!.invoice.totalGross)).toBe(5500);
  });

  it('books the invoice', async () => {
    const booked = await parts.bookInvoice(ctx(), invoiceId);
    expect(booked.status).toBe('booked');
    expect(booked.bookedAt).not.toBeNull();
  });

  it('rejects booking a non-draft invoice', async () => {
    await expect(parts.bookInvoice(ctx(), invoiceId)).rejects.toThrow(
      'SUPPLIER_INVOICE_NOT_DRAFT',
    );
  });

  it('raises a credit note that flips the invoice to credited', async () => {
    const note = await parts.createCreditNote(ctx(), {
      supplierInvoiceId: invoiceId,
      creditNoteNumber: 'CN-2026-001',
      creditNoteDate: new Date('2026-01-20'),
      reason: 'return',
    });
    await parts.addCreditLine(ctx(), {
      supplierCreditNoteId: note.id,
      quantity: 1,
      unitPriceNet: 2500,
      caseId: caseAId,
    });

    const detail = await parts.findSupplierInvoice(ctx(), invoiceId);
    expect(detail!.invoice.status).toBe('credited');
    expect(detail!.creditNotes.length).toBe(1);
    expect(Number(detail!.creditNotes[0]!.totalGross)).toBe(2500);
  });

  it('enforces the unique invoice number per supplier within an org', async () => {
    await expect(
      parts.createSupplierInvoice(ctx(), {
        supplierId,
        invoiceNumber: 'INV-2026-001',
        invoiceDate: new Date('2026-02-01'),
      }),
    ).rejects.toThrow();
  });
});
