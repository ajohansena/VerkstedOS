/**
 * DBS PDF extractor (Workflow Completion batch 1 — issue #11).
 *
 * Maps a DBS-generated PDF takst (e.g. EN64251.pdf) into the same
 * `DbsEstimatePayload` shape the SOAP/REST integration path produces, so the
 * downstream import pipeline (integration_inbox → estimate_imports → lock →
 * invoice_basis) is unchanged. The PDF path is the operator's primary import
 * UX while the official DBS API/XML push channels remain available for
 * production fleet integrations.
 *
 * SCOPE
 * -----
 * • Reliable extraction: identifiers (oppdragsId, skadenr, estimateNumber,
 *   workOrderNumber, insurerName, ownerName, vehicleDescription, vin,
 *   registrationNumber, mileageKm, normalRepairDays) and the totals block
 *   (bodyLabor/paint/parts/externalWork/sumExVat/vatRate/vatAmount/totalAmount
 *   /fixedPriceAgreement). These all come from page 1 (Sammenstilling) in a
 *   fixed Norwegian-label layout.
 * • Best-effort extraction: per-part rows (Reservedelsspesifikasjon) — the
 *   PDF layout is column-major with multi-line descriptions; the extractor
 *   captures `partNumber`/`description`/`listPrice`/`amount` heuristically
 *   and emits a warning for any row that doesn't pattern-match cleanly.
 * • Operations (Arbeidsspesifikasjon) and individual labor lines are NOT
 *   extracted in this first cut — the totals block already carries the
 *   aggregate periods for body/paint/rust which is what every downstream
 *   calculation reads (rate × periods → hours via periodsToHours SSoT).
 *   Operators can lock from totals; if per-operation detail is needed they
 *   paste the normalized JSON or wait for a future DBS API integration.
 *
 * NO OCR: DBS PDFs are digital with structured text. Image-only PDFs would
 * fail extraction (rawText would be empty) — the extractor surfaces that
 * via a warning instead of inventing values.
 *
 * IMMUTABILITY: extracted output is a snapshot. We never mutate inputs. The
 * raw text is returned alongside the payload so it can be persisted into
 * integration_inbox for audit + replay (TakstKontroll compat — rule 4.7).
 */

import {
  dbsEstimatePayloadSchema,
  type DbsEstimatePayload,
} from './dbs-parser';

// pdfjs-dist legacy ESM build is the canonical Node entrypoint (no worker,
// no DOM). Imported lazily inside `extractDbsEstimateFromPdf` because pdfjs
// initialises some module-level state at import time that we don't want to
// pay for unless the operator actually uploads a PDF.

export interface DbsPdfExtractionResult {
  /** Parsed + validated payload (same shape `parseDbsEstimate` accepts). */
  payload: DbsEstimatePayload;
  /** Human-readable extraction warnings (page-number scoped where useful). */
  warnings: string[];
  /** Raw extracted text — persisted in integration_inbox for audit/replay. */
  rawText: string;
}

export class DbsPdfExtractionError extends Error {
  readonly code = 'DBS_PDF_EXTRACTION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'DbsPdfExtractionError';
  }
}

/**
 * Convert a Norwegian-formatted number ("311 841,00" / "1 175,00" / "955") to
 * a JS number. Returns `null` for empty / non-parseable input. The two-decimal
 * normalisation is done by the caller via `toMoneyString` when needed.
 */
function parseNorwegianNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\u00a0/g, ' ') // NBSP
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toMoneyString(n: number | null): string | undefined {
  if (n === null) return undefined;
  return n.toFixed(2);
}

/**
 * Concatenate all page text into one string with explicit page markers so
 * label-based extractors can search the whole document and reporters can cite
 * the page that contained an issue. Each fragment is normalised to trim and
 * collapse runs of whitespace within the fragment (but newlines between
 * fragments are preserved — pdfjs emits one fragment per text run and label-
 * value pairs typically straddle multiple fragments).
 */
async function extractRawText(
  data: Uint8Array,
): Promise<{ rawText: string; pageTexts: string[] }> {
  // Lazy import — see comment above.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data,
      // Worker is not required in the Node server context — pdfjs falls back
      // to in-process execution. Standard fonts emit a harmless warning that
      // is suppressed by leaving `standardFontDataUrl` unset (we don't render
      // glyphs — only extract text).
      useSystemFonts: false,
    }).promise;
  } catch (err) {
    throw new DbsPdfExtractionError(
      `PDF could not be opened: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const fragments = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);
    pageTexts.push(fragments.join('\n'));
  }

  const rawText = pageTexts
    .map((t, i) => `=== PAGE ${i + 1} ===\n${t}`)
    .join('\n\n');
  return { rawText, pageTexts };
}

/**
 * DBS PDF labels — used by `valueAfterLabel` to avoid picking the NEXT label
 * as the value when a column is empty. Norwegian-specific; extend cautiously.
 */
const KNOWN_DBS_LABELS = new Set<string>([
  'bileier',
  'mottager',
  'skadenr.',
  'utskriftsdato',
  'side',
  'forsikringsnr.',
  'skadetype',
  'arbeidsordre nr.',
  'skadedato',
  'ankomst',
  'chassisnr.',
  'påbegynt',
  'ferdig dato',
  'kilometerstand',
  'besiktigelsesdato',
  'registreringsdato',
  'normal reparasjonstid (dager)',
  'skadeområde',
  'objektgruppe',
  'oppdragsid',
  'status',
  'bestillingsdato',
  'sammenstilling',
  'arbeidsspesifikasjon',
  'reservedelsspesifikasjon',
  'tid',
  'deb.faktor',
  'rabatt',
  'beløp',
  'tiltak',
  'delenummer',
  'reservedel/materiell',
  'listepris',
  'egen listepris',
  'rabatt.',
  'sum eks. mva',
  'totalbeløp',
  'fastprisavtale',
]);

/**
 * Find the fragment immediately following a label (case-insensitive exact
 * match on a non-empty fragment). Returns the trimmed value or `null` if the
 * label is absent or the column happens to be empty in this PDF (in which
 * case the next non-empty fragment is itself a known label).
 */
function valueAfterLabel(
  lines: string[],
  label: string,
  maxLookahead = 4,
): string | null {
  const normalisedLabel = label.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.toLowerCase() === normalisedLabel) {
      for (let j = 1; j <= maxLookahead && i + j < lines.length; j++) {
        const candidate = lines[i + j];
        if (candidate && candidate.length > 0) {
          if (KNOWN_DBS_LABELS.has(candidate.toLowerCase())) {
            // Column is empty — adjacent column's label is what we found.
            return null;
          }
          return candidate;
        }
      }
    }
  }
  return null;
}

/**
 * For the Sammenstilling totals rows the pattern is
 *   <label fragment>
 *   <periods>          ← optional
 *   <rate>             ← optional
 *   <amount>
 * Some rows skip periods+rate (e.g. "Reservedeler (rabatt 0,00)" only has
 * the parts total). We extract by matching the label, then walking forward
 * collecting the next numeric fragments up to `maxValues`.
 */
function numericTailAfterLabel(
  lines: string[],
  labelTest: (line: string) => boolean,
  maxValues = 3,
): number[] {
  for (let i = 0; i < lines.length; i++) {
    if (labelTest(lines[i]!)) {
      const out: number[] = [];
      for (let j = i + 1; j < lines.length && out.length < maxValues; j++) {
        const n = parseNorwegianNumber(lines[j]);
        if (n !== null) {
          out.push(n);
        } else if (lines[j]!.length > 0 && !/^[\s\u00a0]+$/.test(lines[j]!)) {
          // Hit a non-numeric, non-empty line → tail ended.
          break;
        }
      }
      return out;
    }
  }
  return [];
}

interface ExtractedTotals {
  bodyLaborPeriods: number;
  bodyLaborAmount: string | undefined;
  panelBeatingPeriods: number;
  rustProtectionPeriods: number;
  paintLaborPeriods: number;
  paintLaborAmount: string | undefined;
  paintMaterialAmount: string | undefined;
  partsAmount: string | undefined;
  externalWorkAmount: string | undefined;
  sumExVat: string | undefined;
  vatRate: number | undefined;
  vatAmount: string | undefined;
  totalAmount: string | undefined;
  fixedPriceAgreement: string | undefined;
}

function extractTotals(page1Text: string, warnings: string[]): ExtractedTotals {
  const lines = page1Text.split('\n');

  // Periods + rate + amount rows.
  const body = numericTailAfterLabel(
    lines,
    (l) => /^Karosseriarbeide\b/i.test(l),
    3,
  );
  const panel = numericTailAfterLabel(
    lines,
    (l) => /^Karosseri\s*-\s*Flaterette/i.test(l),
    3,
  );
  const rust = numericTailAfterLabel(
    lines,
    (l) => /^Rustbeskyttelse/i.test(l),
    3,
  );
  const paint = numericTailAfterLabel(lines, (l) => /^Lakkarbeide/i.test(l), 3);

  // Single-amount rows.
  const parts = numericTailAfterLabel(
    lines,
    (l) => /^Reservedeler\b/i.test(l),
    1,
  );
  const externalWork = numericTailAfterLabel(
    lines,
    (l) => /^Eksternt\s+arbeid/i.test(l),
    1,
  );
  const paintMaterial = numericTailAfterLabel(
    lines,
    (l) => /^Lakkmateriell/i.test(l),
    1,
  );
  const sumExVat = numericTailAfterLabel(
    lines,
    (l) => /^Sum\s+eks\.\s*mva/i.test(l),
    1,
  );
  const totalAmount = numericTailAfterLabel(
    lines,
    (l) => /^Totalbel[øo]p/i.test(l),
    1,
  );
  const fastpris = numericTailAfterLabel(
    lines,
    (l) => /^Fastprisavtale/i.test(l),
    1,
  );

  // VAT line includes the rate inline: "MVA 25,00 % av 249 473,01".
  const vatLineIdx = lines.findIndex((l) => /^MVA\s+\d/i.test(l));
  let vatRate: number | undefined;
  let vatAmount: string | undefined;
  if (vatLineIdx >= 0) {
    const m = lines[vatLineIdx]!.match(/^MVA\s+([0-9 .,]+)\s*%/i);
    if (m) {
      const rate = parseNorwegianNumber(m[1]!);
      if (rate !== null) vatRate = rate;
    }
    // Amount is the next numeric fragment after the MVA label.
    for (
      let j = vatLineIdx + 1;
      j < Math.min(vatLineIdx + 4, lines.length);
      j++
    ) {
      const n = parseNorwegianNumber(lines[j]);
      if (n !== null) {
        vatAmount = toMoneyString(n);
        break;
      }
    }
  }

  if (totalAmount.length === 0) {
    warnings.push(
      'Totalbeløp ikke funnet på side 1 (Sammenstilling). Sjekk PDF-en.',
    );
  }

  return {
    bodyLaborPeriods: body[0] ?? 0,
    bodyLaborAmount: toMoneyString(body[2] ?? null),
    panelBeatingPeriods: panel[0] ?? 0,
    rustProtectionPeriods: rust[0] ?? 0,
    paintLaborPeriods: paint[0] ?? 0,
    paintLaborAmount: toMoneyString(paint[2] ?? null),
    paintMaterialAmount: toMoneyString(paintMaterial[0] ?? null),
    partsAmount: toMoneyString(parts[0] ?? null),
    externalWorkAmount: toMoneyString(externalWork[0] ?? null),
    sumExVat: toMoneyString(sumExVat[0] ?? null),
    vatRate,
    vatAmount,
    totalAmount: toMoneyString(totalAmount[0] ?? null),
    fixedPriceAgreement: toMoneyString(fastpris[0] ?? null),
  };
}

interface ExtractedDocument {
  estimateNumber?: string;
  workOrderNumber?: string;
  insurerName?: string;
  ownerName?: string;
  vehicleDescription?: string;
  vin?: string;
  registrationNumber?: string;
  mileageKm?: number;
  normalRepairDays?: number;
  damageType?: string;
  objectGroup?: string;
}

function extractDocument(
  fullText: string,
  warnings: string[],
): {
  document: ExtractedDocument;
  oppdragsId?: string;
  skadenr?: string;
} {
  const lines = fullText.split('\n');

  // Oppdragsid is its own labelled row → valueAfterLabel works.
  const oppdrag = valueAfterLabel(lines, 'Oppdragsid');

  // Skadenr lives in a 3-column header cluster (Bileier / Mottager / Skadenr.)
  // so valueAfterLabel grabs the first column's value ("Dnb Bank ASA") not
  // the third. The DBS skadenummer format is distinctive: digits, comma,
  // 3-digit suffix (e.g. "79536781,675"). Regex on the full text is more
  // reliable than positional walking here.
  const skadenrMatch = fullText.match(/\b(\d{6,9},\d{3,4})\b/);
  const skadenr = skadenrMatch ? skadenrMatch[1] : null;

  const skadetype = valueAfterLabel(lines, 'Skadetype');
  const objektgruppe = valueAfterLabel(lines, 'Objektgruppe');
  const arbeidsordre = valueAfterLabel(lines, 'Arbeidsordre nr.');
  const chassisnr = valueAfterLabel(lines, 'Chassisnr.');
  const kilometerstand = valueAfterLabel(lines, 'Kilometerstand');
  const normalRepDays = valueAfterLabel(lines, 'Normal reparasjonstid (dager)');

  // Estimate number ("EN64251") shows up in the page header "EN64251 1( 1)".
  // The fragment "EN64251" appears multiple times — first one is canonical.
  const estimateNumberLine = lines.find((l) => /^EN\d{4,}$/i.test(l));

  // Vehicle line: "07-28769-2025 CITROEN E-C4 KOMBI-KUPE 5D" appears on page 1.
  // The plate-and-description tuple isn't labelled — match the pattern of
  // (digits-digits-digits SPACE word(s)).
  const vehicleLine = lines.find((l) => /^\d{2}-\d{4,5}-\d{4}\s+\S/.test(l));
  let registrationNumber: string | undefined;
  let vehicleDescription: string | undefined;
  if (vehicleLine) {
    const m = vehicleLine.match(/^(\S+)\s+(.*)$/);
    if (m) {
      // Strip the work-order prefix → plate is the part after the last dash.
      const plateGuess = m[1]!.split('-').pop();
      if (plateGuess && /^[A-Z0-9]{2,8}$/i.test(plateGuess)) {
        registrationNumber = plateGuess.toUpperCase();
      }
      vehicleDescription = m[2]!.trim();
    }
  }

  // Insurer + owner: the page 1 layout has labels "Bileier" and "Mottager"
  // followed by name blocks. The owner-name fragment is usually 2 fragments
  // after Bileier (skipping the address block start).
  // Simplest heuristic: insurer name appears between "Mottager" and
  // "Skadenr." Owner name appears between "Bileier" and "Mottager".
  // We capture the first non-empty, non-whitespace, non-numeric fragment.
  const bileierIdx = lines.findIndex((l) => l === 'Bileier');
  const mottagerIdx = lines.findIndex((l) => l === 'Mottager');
  let ownerName: string | undefined;
  let insurerName: string | undefined;
  if (bileierIdx >= 0 && mottagerIdx > bileierIdx) {
    ownerName = lines
      .slice(bileierIdx + 1, mottagerIdx)
      .find((l) => /[A-Za-zÆØÅæøå]/.test(l) && !/^\d/.test(l));
  }
  if (mottagerIdx >= 0) {
    insurerName = lines
      .slice(mottagerIdx + 1, mottagerIdx + 6)
      .find((l) => /[A-Za-zÆØÅæøå]/.test(l) && !/^\d/.test(l));
  }

  const doc: ExtractedDocument = {};
  if (estimateNumberLine) doc.estimateNumber = estimateNumberLine;
  if (arbeidsordre) doc.workOrderNumber = arbeidsordre;
  if (insurerName) doc.insurerName = insurerName;
  if (ownerName) doc.ownerName = ownerName;
  if (vehicleDescription) doc.vehicleDescription = vehicleDescription;
  if (chassisnr) doc.vin = chassisnr;
  if (registrationNumber) doc.registrationNumber = registrationNumber;
  if (kilometerstand) {
    const km = parseNorwegianNumber(kilometerstand);
    if (km !== null && Number.isInteger(km)) doc.mileageKm = km;
  }
  if (normalRepDays) {
    const d = parseNorwegianNumber(normalRepDays);
    if (d !== null && Number.isInteger(d)) doc.normalRepairDays = d;
  }
  if (skadetype) doc.damageType = skadetype;
  if (objektgruppe) doc.objectGroup = objektgruppe;

  if (!doc.estimateNumber) {
    warnings.push('Takstnummer (EN…) ikke funnet i PDF.');
  }
  if (!doc.registrationNumber) {
    warnings.push(
      'Registreringsnummer ikke funnet i PDF — sjekk at takstrapporten er fra DBS.',
    );
  }

  const result: {
    document: ExtractedDocument;
    oppdragsId?: string;
    skadenr?: string;
  } = { document: doc };
  if (oppdrag) result.oppdragsId = oppdrag;
  if (skadenr) result.skadenr = skadenr;
  return result;
}

/**
 * Best-effort parts extraction. Walks every page that contains the
 * "Reservedelsspesifikasjon" section header and reads tuples of
 * (partNumber, description, listPrice, amount). A part-number fragment is
 * the trigger; the description is the next non-numeric fragment(s); the
 * first two numerics following are listPrice / amount.
 *
 * Rows that don't pattern-match are skipped with a warning rather than
 * inventing values.
 */
function extractParts(
  pageTexts: string[],
  warnings: string[],
): Array<{
  partNumber: string;
  description: string;
  listPrice?: string;
  amount?: string;
}> {
  const out: Array<{
    partNumber: string;
    description: string;
    listPrice?: string;
    amount?: string;
  }> = [];

  for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
    const text = pageTexts[pageIdx]!;
    if (!/Reservedelsspesifikasjon/i.test(text)) continue;

    const lines = text.split('\n');
    // Find header row index.
    const headerIdx = lines.findIndex((l) => /^Delenummer$/i.test(l));
    if (headerIdx < 0) continue;

    let cursor = headerIdx + 1;
    // Part numbers in DBS PDFs are alphanumeric starting with a digit. Tight
    // pattern avoids matching description fragments like "H Forskjerm" or
    // column headers like "Listepris".
    const partNumberPattern = /^[0-9][0-9A-Z ]{4,14}$/;

    while (cursor < lines.length) {
      const line = lines[cursor]!;
      // Stop at footer markers.
      if (/^(Autoin|Side|Utskriftsdato|Smalvollveien)/i.test(line)) break;

      if (
        partNumberPattern.test(line) &&
        !KNOWN_DBS_LABELS.has(line.toLowerCase())
      ) {
        const partNumber = line.replace(/\s+/g, ' ').trim();
        const descChunks: string[] = [];
        const nums: number[] = [];
        let j = cursor + 1;
        while (j < lines.length && nums.length < 2) {
          const candidate = lines[j]!;
          const n = parseNorwegianNumber(candidate);
          if (n !== null) {
            nums.push(n);
          } else if (
            partNumberPattern.test(candidate) &&
            /^[A-Z0-9]/.test(candidate) &&
            descChunks.length > 0
          ) {
            // Next part starts before we've collected two prices → stop.
            break;
          } else if (candidate.length > 0) {
            descChunks.push(candidate);
          }
          j++;
        }
        const description = descChunks.join(' ').trim();
        if (description.length === 0) {
          warnings.push(
            `Reservedel ${partNumber} på side ${pageIdx + 1} mangler beskrivelse i PDF — hopper over.`,
          );
        } else {
          const part: {
            partNumber: string;
            description: string;
            listPrice?: string;
            amount?: string;
          } = { partNumber, description };
          const list = toMoneyString(nums[0] ?? null);
          if (list !== undefined) part.listPrice = list;
          const amt = toMoneyString(nums[1] ?? nums[0] ?? null);
          if (amt !== undefined) part.amount = amt;
          out.push(part);
        }
        cursor = j;
      } else {
        cursor++;
      }
    }
  }

  return out;
}

/**
 * Top-level: convert a DBS PDF buffer into a validated `DbsEstimatePayload`
 * plus warnings + raw text. Throws `DbsPdfExtractionError` only when the PDF
 * cannot be opened or has no text (likely scanned/image-only — operator
 * needs the official DBS API integration or a digital PDF).
 */
export async function extractDbsEstimateFromPdf(
  data: Uint8Array,
): Promise<DbsPdfExtractionResult> {
  const warnings: string[] = [];
  const { rawText, pageTexts } = await extractRawText(data);

  if (rawText.replace(/===.*===/g, '').trim().length === 0) {
    throw new DbsPdfExtractionError(
      'PDF inneholder ingen lesbar tekst (sannsynligvis innskannet bilde). DBS API eller digital PDF kreves.',
    );
  }

  const page1Text = pageTexts[0] ?? '';
  const totals = extractTotals(page1Text, warnings);
  const docExtract = extractDocument(rawText, warnings);
  const parts = extractParts(pageTexts, warnings);

  const candidate: unknown = {
    ...(docExtract.oppdragsId ? { oppdragsId: docExtract.oppdragsId } : {}),
    ...(docExtract.skadenr ? { skadenr: docExtract.skadenr } : {}),
    document: docExtract.document,
    operations: [], // per-operation extraction deferred — see header.
    laborLines: [],
    paintLines: [],
    parts,
    totals,
  };

  const parsed = dbsEstimatePayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DbsPdfExtractionError(
      issue
        ? `PDF gav ugyldig payload: ${issue.path.join('.')}: ${issue.message}`
        : 'PDF gav ugyldig payload.',
    );
  }

  return { payload: parsed.data, warnings, rawText };
}
