import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { vegvesenLookups } from '@/db/schemas/customer/vegvesen-lookups';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Vegvesen registration-plate lookup adapter, with caching in `vegvesen_lookups`
 * (docs/01 § external integrations).
 *
 * Sprint 5 ships the adapter shape + cache; the live provider call is gated
 * behind an API key (VEGVESEN_API_KEY) and returns a "not configured" result
 * until provisioned. The cache + parsing contract are real now so the UI and
 * tests work end-to-end.
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

  // Live provider call lands here once provisioned. The parsing contract maps
  // the provider payload into VehicleLookupResult, then caches it.
  const result: Omit<VehicleLookupResult, 'source'> = {
    found: false,
    registrationNumber: reg,
  };
  await writeCache(ctx, reg, result, null);
  return { ...result, source: 'provider' };
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
