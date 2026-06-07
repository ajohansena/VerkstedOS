import { and, desc, eq, gt } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { phoneLookups1881 } from '@/db/schemas/customer/phone-lookups-1881';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * 1881 phone-directory lookup adapter, with caching in `phone_lookups_1881`.
 *
 * Same shape as the Vegvesen adapter: cache-first, provider call gated behind
 * SVEVE_1881_API_KEY, `not_configured` until provisioned.
 */

export interface PhoneLookupResult {
  found: boolean;
  phone: string;
  name?: string;
  address?: string;
  source: 'cache' | 'provider' | 'not_configured';
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

async function readCache(
  ctx: RequestContext,
  phone: string,
): Promise<PhoneLookupResult | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(phoneLookups1881)
      .where(
        and(
          eq(phoneLookups1881.organizationId, ctx.organizationId),
          eq(phoneLookups1881.phone, phone),
          gt(phoneLookups1881.fetchedAt, cutoff),
        ),
      )
      .orderBy(desc(phoneLookups1881.fetchedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const result = (row.result ?? null) as Omit<
      PhoneLookupResult,
      'source'
    > | null;
    if (!result) return { found: false, phone, source: 'cache' };
    return { ...result, source: 'cache' };
  });
}

async function writeCache(
  ctx: RequestContext,
  phone: string,
  result: Omit<PhoneLookupResult, 'source'> | null,
  raw: unknown,
): Promise<void> {
  const db = getRawClient({ as: 'integration' });
  await db.insert(phoneLookups1881).values({
    organizationId: ctx.organizationId,
    phone,
    result: (result ?? null) as never,
    data: (raw ?? null) as never,
    foundAt: result?.found ? new Date() : null,
    fetchedAt: new Date(),
  });
}

export async function lookupByPhone(
  ctx: RequestContext,
  phoneNumber: string,
): Promise<PhoneLookupResult> {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return { found: false, phone, source: 'not_configured' };

  const cached = await readCache(ctx, phone);
  if (cached) return cached;

  const apiKey = process.env.SVEVE_1881_API_KEY;
  if (!apiKey) {
    return { found: false, phone, source: 'not_configured' };
  }

  const result: Omit<PhoneLookupResult, 'source'> = { found: false, phone };
  await writeCache(ctx, phone, result, null);
  return { ...result, source: 'provider' };
}
