import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DbsPdfExtractionError,
  extractDbsEstimateFromPdf,
} from './dbs-pdf-extractor';

/**
 * Reality test: the extractor must produce a sensible DbsEstimatePayload from
 * the canonical reference PDF (docs/reference/dbs/EN64251.pdf). If this test
 * fails after a pdfjs-dist upgrade, the extractor needs adjustment.
 */
describe('extractDbsEstimateFromPdf — EN64251.pdf reference', () => {
  let buf: Uint8Array;

  it('opens the reference PDF and produces a validated payload', async () => {
    const path = resolve(process.cwd(), 'docs/reference/dbs/EN64251.pdf');
    buf = new Uint8Array(await readFile(path));
    const result = await extractDbsEstimateFromPdf(buf);

    // ── identifiers ─────────────────────────────────────────────
    expect(result.payload.oppdragsId).toBe('26079539T2');
    expect(result.payload.skadenr).toBe('79536781,675');
    expect(result.payload.document.estimateNumber).toBe('EN64251');
    // workOrderNumber column is empty in this PDF — extractor should NOT
    // invent a value (would have picked the next label "Skadedato" otherwise).
    expect(result.payload.document.workOrderNumber).toBeUndefined();
    expect(result.payload.document.vin).toBe('VR7BCZKW0SE031337');
    expect(result.payload.document.registrationNumber).toBeDefined();
    expect(result.payload.document.vehicleDescription).toContain('CITROEN');
    expect(result.payload.document.normalRepairDays).toBe(12);
    expect(result.payload.document.damageType).toBe('Kasko');
    expect(result.payload.document.objectGroup).toContain('Personbil');
    expect(result.payload.document.mileageKm).toBe(22056);

    // ── totals (Sammenstilling page 1) ──────────────────────────
    const t = result.payload.totals;
    expect(t).toBeDefined();
    expect(t?.bodyLaborPeriods).toBe(3260);
    expect(t?.bodyLaborAmount).toBe('31133.00');
    expect(t?.panelBeatingPeriods).toBe(100);
    expect(t?.rustProtectionPeriods).toBe(15);
    expect(t?.paintLaborPeriods).toBe(1091);
    expect(t?.paintLaborAmount).toBe('12819.25');
    expect(t?.paintMaterialAmount).toBe('4684.80');
    expect(t?.partsAmount).toBe('190737.71');
    expect(t?.externalWorkAmount).toBe('9000.00');
    expect(t?.sumExVat).toBe('249473.01');
    expect(t?.vatRate).toBe(25);
    expect(t?.vatAmount).toBe('62368.25');
    expect(t?.totalAmount).toBe('311841.00');
    expect(t?.fixedPriceAgreement).toBe('290000.00');

    // ── parts (best-effort) ─────────────────────────────────────
    // We expect at least one canonical part to land cleanly; the per-row
    // heuristic is best-effort so an exact count assertion is brittle.
    expect(result.payload.parts.length).toBeGreaterThan(5);
    const forskjerm = result.payload.parts.find(
      (p) => p.partNumber === '9831194480',
    );
    expect(forskjerm).toBeDefined();
    expect(forskjerm?.description).toContain('Forskjerm');
    expect(forskjerm?.amount).toBe('4083.66');

    // ── raw text + warnings shape ───────────────────────────────
    expect(result.rawText).toContain('=== PAGE 1 ===');
    expect(result.rawText).toContain('Sammenstilling');
    expect(Array.isArray(result.warnings)).toBe(true);
  }, 60_000);

  it('throws DbsPdfExtractionError for a non-PDF input', async () => {
    const garbage = new Uint8Array(Buffer.from('Not a PDF', 'utf8'));
    await expect(extractDbsEstimateFromPdf(garbage)).rejects.toBeInstanceOf(
      DbsPdfExtractionError,
    );
  }, 30_000);
});
