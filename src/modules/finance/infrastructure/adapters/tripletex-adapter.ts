/**
 * Tripletex accounting adapter (Sprint 15) — the first accounting integration.
 *
 * Env-gated like the Vegvesen adapter: a live push requires `TRIPLETEX_API_KEY`
 * + `TRIPLETEX_API_URL`. When those are absent the behaviour depends on the
 * environment:
 *   - production: returns `not_configured` (we cannot post without credentials);
 *   - dev / test: returns a `simulated` success with a synthetic voucher ref so
 *     the end-to-end approve → export → audit chain is demoable locally.
 *
 * The live HTTP call is intentionally deferred (no production Tripletex
 * credentials in the MVP pipeline yet); when credentials are present but the
 * live path is not yet wired we surface a retryable error rather than silently
 * succeeding. `source` is always reported so callers and the Dev surface can
 * see exactly how an export was satisfied.
 */

export type TripletexSource = 'provider' | 'simulated' | 'not_configured';

export interface TripletexExportLine {
  readonly basisId: string;
  readonly basisNumber: string;
  readonly payerType: string;
  readonly netAmount: string;
  readonly vatAmount: string;
  readonly grossAmount: string;
  readonly currency: string;
}

export interface TripletexExportPayload {
  readonly exportId: string;
  readonly organizationId: string;
  readonly lines: ReadonlyArray<TripletexExportLine>;
}

export interface TripletexExportResult {
  readonly ok: boolean;
  readonly source: TripletexSource;
  readonly externalRef: string | null;
  readonly error?: string;
}

export function tripletexConfigured(): boolean {
  return Boolean(
    process.env['TRIPLETEX_API_KEY'] && process.env['TRIPLETEX_API_URL'],
  );
}

export async function postExportToTripletex(
  payload: TripletexExportPayload,
): Promise<TripletexExportResult> {
  const apiKey = process.env['TRIPLETEX_API_KEY'];
  const apiUrl = process.env['TRIPLETEX_API_URL'];

  if (!apiKey || !apiUrl) {
    if (process.env['NODE_ENV'] === 'production') {
      return {
        ok: false,
        source: 'not_configured',
        externalRef: null,
        error: 'TRIPLETEX_NOT_CONFIGURED',
      };
    }
    // Dev / test: simulate a successful voucher so the chain is demoable.
    return {
      ok: true,
      source: 'simulated',
      externalRef: `SIM-${payload.exportId.slice(0, 8).toUpperCase()}`,
    };
  }

  // Live Tripletex push is deferred until production credentials exist.
  return {
    ok: false,
    source: 'not_configured',
    externalRef: null,
    error: 'TRIPLETEX_LIVE_NOT_IMPLEMENTED',
  };
}
