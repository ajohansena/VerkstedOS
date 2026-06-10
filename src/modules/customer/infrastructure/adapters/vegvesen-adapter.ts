import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { vegvesenLookups } from '@/db/schemas/customer/vegvesen-lookups';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Vegvesen registration-plate lookup adapter, with caching in `vegvesen_lookups`
 * (docs/01 § external integrations).
 *
 * Cache-first; only calls the Statens vegvesen Akfell API on a cache miss
 * (TTL 7 days). The live call is gated on `VEGVESEN_API_KEY` and is wrapped in
 * a tight timeout so a slow provider can never block the intake wizard. Any
 * failure surfaces as `found: false` with source `provider` (still cached
 * negatively for a short window to avoid hammering the API).
 *
 * Endpoint: https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata
 * Header:   SVV-Authorization: Apikey <key>
 */

export interface VehicleLookupResult {
  found: boolean;
  registrationNumber: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  colour?: string;
  source: 'cache' | 'provider' | 'not_configured';
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function normalizeReg(reg: string): string {
  return reg.replace(/\s/g, '').toUpperCase();
}

/** Read a fresh cached lookup, if any. */
async function readCache(
  ctx: RequestContext,
  reg: string,
): Promise<VehicleLookupResult | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(vegvesenLookups)
      .where(
        and(
          eq(vegvesenLookups.organizationId, ctx.organizationId),
          eq(vegvesenLookups.registrationNumber, reg),
          gt(vegvesenLookups.fetchedAt, cutoff),
        ),
      )
      .orderBy(desc(vegvesenLookups.fetchedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const result = (row.result ?? null) as Omit<
      VehicleLookupResult,
      'source'
    > | null;
    if (!result) {
      return { found: false, registrationNumber: reg, source: 'cache' };
    }
    return { ...result, source: 'cache' };
  });
}

/** Persist a lookup result to the cache (service-role; cache is audit-none). */
async function writeCache(
  ctx: RequestContext,
  reg: string,
  result: Omit<VehicleLookupResult, 'source'> | null,
  raw: unknown,
): Promise<void> {
  const db = getRawClient({ as: 'integration' });
  await db.insert(vegvesenLookups).values({
    organizationId: ctx.organizationId,
    registrationNumber: reg,
    result: (result ?? null) as never,
    data: (raw ?? null) as never,
    foundAt: result?.found ? new Date() : null,
    fetchedAt: new Date(),
  });
}

/**
 * Look up a vehicle by registration plate. Cache-first; calls the provider only
 * on a cache miss. Returns a `not_configured` result when no API key is set.
 */
export async function lookupVehicleByReg(
  ctx: RequestContext,
  registrationNumber: string,
): Promise<VehicleLookupResult> {
  const reg = normalizeReg(registrationNumber);
  if (!reg) {
    return { found: false, registrationNumber: reg, source: 'not_configured' };
  }

  const cached = await readCache(ctx, reg);
  if (cached) return cached;

  const apiKey = process.env.VEGVESEN_API_KEY;
  if (!apiKey) {
    // Not provisioned yet — do not cache a negative we can't trust.
    return { found: false, registrationNumber: reg, source: 'not_configured' };
  }

  // Live Akfell call. Wrapped in tight timeout + try/catch so the wizard never
  // blocks on a slow or unreachable provider. On any failure we return `not
  // found` from the provider WITHOUT caching it — so a transient outage doesn't
  // pin a negative for 7 days.
  let parsed: Omit<VehicleLookupResult, 'source'> = {
    found: false,
    registrationNumber: reg,
  };
  let raw: unknown = null;
  let providerOk = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(
        `https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=${encodeURIComponent(reg)}`,
        {
          headers: {
            'SVV-Authorization': `Apikey ${apiKey}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );
      if (res.status === 404) {
        // Provider says: plate unknown. Cache negative.
        providerOk = true;
      } else if (res.ok) {
        raw = await res.json();
        parsed = parseVegvesenPayload(reg, raw);
        providerOk = true;
      } else {
        // 401/403/5xx: log and fall through without caching.
        console.warn(
          `[vegvesen] HTTP ${res.status} for plate ${reg.slice(0, 2)}…`,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(
      `[vegvesen] lookup failed for plate ${reg.slice(0, 2)}…`,
      err instanceof Error ? err.message : err,
    );
  }

  if (providerOk) {
    await writeCache(ctx, reg, parsed, raw);
  }
  return { ...parsed, source: 'provider' };
}

/**
 * Parse the Akfell `kjoretoydata` payload into our normalized result. Only
 * pulls fields the UI actually needs (No-Cleverness rule). The Akfell schema
 * is verbose — we walk it defensively because field presence varies by
 * vehicle category and registration history.
 */
export function parseVegvesenPayload(
  reg: string,
  raw: unknown,
): Omit<VehicleLookupResult, 'source'> {
  const empty: Omit<VehicleLookupResult, 'source'> = {
    found: false,
    registrationNumber: reg,
  };
  if (!raw || typeof raw !== 'object') return empty;

  // Akfell wraps results in `kjoretoydataListe` (an array) — pick the first.
  // If the wrapper exists but is empty, treat as not-found. Only fall back to
  // the top-level entry when the wrapper key is missing entirely.
  const root = raw as Record<string, unknown>;
  let entry: unknown = root;
  if ('kjoretoydataListe' in root) {
    const liste = root['kjoretoydataListe'];
    if (!Array.isArray(liste) || liste.length === 0) return empty;
    entry = liste[0];
  }
  if (!entry || typeof entry !== 'object') return empty;
  const e = entry as Record<string, unknown>;

  const kjoretoyId = (e['kjoretoyId'] ?? {}) as Record<string, unknown>;
  const vin =
    typeof kjoretoyId['understellsnummer'] === 'string'
      ? (kjoretoyId['understellsnummer'] as string)
      : undefined;

  const godkjenning = (e['godkjenning'] ?? {}) as Record<string, unknown>;
  const tekniskGodkjenning = (godkjenning['tekniskGodkjenning'] ?? {}) as Record<
    string,
    unknown
  >;
  const tekniskeData = (tekniskGodkjenning['tekniskeData'] ?? {}) as Record<
    string,
    unknown
  >;
  const generelt = (tekniskeData['generelt'] ?? {}) as Record<string, unknown>;

  // merke is `[{ merke: 'TOYOTA' }]`
  let make: string | undefined;
  const merkeList = generelt['merke'];
  if (Array.isArray(merkeList) && merkeList.length > 0) {
    const m = merkeList[0] as Record<string, unknown> | undefined;
    if (m && typeof m['merke'] === 'string') make = m['merke'] as string;
  }

  // handelsbetegnelse is `['YARIS']`
  let model: string | undefined;
  const modelList = generelt['handelsbetegnelse'];
  if (Array.isArray(modelList) && modelList.length > 0) {
    if (typeof modelList[0] === 'string') model = modelList[0];
    else if (
      modelList[0] &&
      typeof (modelList[0] as Record<string, unknown>)['handelsbetegnelse'] ===
        'string'
    ) {
      model = (modelList[0] as Record<string, unknown>)[
        'handelsbetegnelse'
      ] as string;
    }
  }

  // Year: forstegangsregistrering.registrertForstegangNorgeDato → YYYY-MM-DD
  let year: number | undefined;
  const forstegang = e['forstegangsregistrering'] as
    | Record<string, unknown>
    | undefined;
  const dato = forstegang?.['registrertForstegangNorgeDato'];
  if (typeof dato === 'string' && dato.length >= 4) {
    const y = Number.parseInt(dato.slice(0, 4), 10);
    if (Number.isFinite(y) && y > 1900 && y < 2100) year = y;
  }

  // Colour: karosseriOgLasteplan.rFarge[0].kodeNavn
  let colour: string | undefined;
  const karosseri = tekniskeData['karosseriOgLasteplan'] as
    | Record<string, unknown>
    | undefined;
  const farger = karosseri?.['rFarge'];
  if (Array.isArray(farger) && farger.length > 0) {
    const f = farger[0] as Record<string, unknown> | undefined;
    if (f && typeof f['kodeNavn'] === 'string') {
      colour = (f['kodeNavn'] as string).toLowerCase();
    }
  }

  return {
    found: true,
    registrationNumber: reg,
    ...(make ? { make } : {}),
    ...(model ? { model } : {}),
    ...(year ? { year } : {}),
    ...(vin ? { vin } : {}),
    ...(colour ? { colour } : {}),
  };
}

/** Cache stats for the Dev Control Plane. */
export async function vegvesenCacheStats(
  ctx: RequestContext,
): Promise<{ total: number }> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vegvesenLookups)
      .where(eq(vegvesenLookups.organizationId, ctx.organizationId));
    return { total: rows[0]?.n ?? 0 };
  });
}
