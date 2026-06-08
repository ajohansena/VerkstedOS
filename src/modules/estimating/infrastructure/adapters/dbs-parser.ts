import { z } from 'zod';

/**
 * DBS estimate parser (docs/reference/dbs — FNF Integrasjonsguide + EN64251).
 *
 * VerkstedOS imports a DBS takst as a NORMALIZED JSON payload. In production the
 * raw DBS message (SOAP `sendOppdrag` or the newer REST payload) is mapped to
 * this normalized shape by a thin transport layer; this parser validates that
 * shape and produces the structured entities the import service persists.
 *
 * CRITICAL: all `timePeriods` values are DBS PERIODS (100 = 1 hour). The parser
 * never converts — conversion is the SSoT calc `periodsToHours`. Keeping periods
 * verbatim preserves the immutable snapshot (rule 4.7).
 */

const moneyString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v))
  .optional();

export const dbsOperationSchema = z.object({
  category: z
    .enum([
      'body_labor',
      'panel_beating',
      'rust_protection',
      'paint_labor',
      'paint_material',
      'part',
      'external_work',
      'other',
    ])
    .default('body_labor'),
  description: z.string().min(1),
  action: z.string().optional(),
  side: z.enum(['H', 'V']).optional(),
  timePeriods: z.number().int().nonnegative().default(0),
  laborRate: moneyString,
});

export const dbsLaborLineSchema = z.object({
  position: z.string().optional(),
  operationCode: z.string().optional(),
  description: z.string().min(1),
  timePeriods: z.number().int().nonnegative().default(0),
});

export const dbsPaintLineSchema = z.object({
  description: z.string().min(1),
  isMaterial: z.boolean().default(false),
  timePeriods: z.number().int().nonnegative().default(0),
  laborRate: moneyString,
  amount: moneyString,
});

export const dbsPartSchema = z.object({
  partNumber: z.string().optional(),
  description: z.string().min(1),
  listPrice: moneyString,
  discountFactor: z.string().optional(),
  amount: moneyString,
});

export const dbsTotalsSchema = z.object({
  bodyLaborPeriods: z.number().int().nonnegative().default(0),
  bodyLaborAmount: moneyString,
  panelBeatingPeriods: z.number().int().nonnegative().default(0),
  rustProtectionPeriods: z.number().int().nonnegative().default(0),
  paintLaborPeriods: z.number().int().nonnegative().default(0),
  paintLaborAmount: moneyString,
  paintMaterialAmount: moneyString,
  partsAmount: moneyString,
  externalWorkAmount: moneyString,
  sumExVat: moneyString,
  vatRate: z.union([z.number(), z.string()]).optional(),
  vatAmount: moneyString,
  totalAmount: moneyString,
  fixedPriceAgreement: moneyString,
});

export const dbsEstimatePayloadSchema = z.object({
  /** DBS source identifiers, used for dedupe + traceability. */
  oppdragsId: z.string().optional(),
  skadenr: z.string().optional(),
  document: z.object({
    estimateNumber: z.string().optional(),
    workOrderNumber: z.string().optional(),
    insurerName: z.string().optional(),
    ownerName: z.string().optional(),
    damageType: z.string().optional(),
    objectGroup: z.string().optional(),
    vehicleDescription: z.string().optional(),
    vin: z.string().optional(),
    registrationNumber: z.string().optional(),
    mileageKm: z.number().int().nonnegative().optional(),
    colourCode: z.string().optional(),
    normalRepairDays: z.number().int().nonnegative().optional(),
    dates: z.record(z.string(), z.string()).optional(),
    workshopRef: z.string().optional(),
  }),
  operations: z.array(dbsOperationSchema).default([]),
  laborLines: z.array(dbsLaborLineSchema).default([]),
  paintLines: z.array(dbsPaintLineSchema).default([]),
  parts: z.array(dbsPartSchema).default([]),
  totals: dbsTotalsSchema.optional(),
});

export type DbsEstimatePayload = z.infer<typeof dbsEstimatePayloadSchema>;
export type DbsOperation = z.infer<typeof dbsOperationSchema>;
export type DbsLaborLine = z.infer<typeof dbsLaborLineSchema>;
export type DbsPaintLine = z.infer<typeof dbsPaintLineSchema>;
export type DbsPart = z.infer<typeof dbsPartSchema>;
export type DbsTotals = z.infer<typeof dbsTotalsSchema>;

export interface ParsedEstimate {
  oppdragsId: string | null;
  skadenr: string | null;
  document: DbsEstimatePayload['document'];
  operations: DbsOperation[];
  laborLines: DbsLaborLine[];
  paintLines: DbsPaintLine[];
  parts: DbsPart[];
  totals: DbsTotals | null;
}

export class DbsParseError extends Error {
  readonly code = 'DBS_PARSE_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'DbsParseError';
  }
}

/**
 * Parse + validate a normalized DBS payload into structured entities. Throws
 * `DbsParseError` with a readable message on invalid input (the integration
 * inbox records the error for replay).
 */
export function parseDbsEstimate(raw: unknown): ParsedEstimate {
  const result = dbsEstimatePayloadSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DbsParseError(
      issue
        ? `${issue.path.join('.')}: ${issue.message}`
        : 'Invalid DBS payload',
    );
  }
  const p = result.data;
  return {
    oppdragsId: p.oppdragsId ?? null,
    skadenr: p.skadenr ?? null,
    document: p.document,
    operations: p.operations,
    laborLines: p.laborLines,
    paintLines: p.paintLines,
    parts: p.parts,
    totals: p.totals ?? null,
  };
}
