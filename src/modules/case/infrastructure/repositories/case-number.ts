import { and, eq, sql } from 'drizzle-orm';

import type { TenantTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Per-org case-number generator (docs/03-data-model.md — case_number unique per
 * org, custom format per org).
 *
 * The format string lives in `organizations.settings.caseNumberFormat` and
 * supports tokens:
 *   {YYYY} → 4-digit year
 *   {SEQ}  → zero-padded sequence (default width 4; {SEQ:6} for width 6)
 * Default format: `{YYYY}-{SEQ}` → e.g. `2026-0001`.
 *
 * The sequence is the count of existing cases in the org for the current year
 * plus one, computed inside the caller's transaction to avoid a separate
 * counter table for the MVP. The unique index on (org, case_number) is the
 * hard guard against collisions.
 */

interface OrgSettings {
  caseNumberFormat?: string;
}

const DEFAULT_FORMAT = '{YYYY}-{SEQ}';

export function formatCaseNumber(
  format: string,
  year: number,
  seq: number,
): string {
  return format
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, width: string | undefined) =>
      String(seq).padStart(width ? Number(width) : 4, '0'),
    );
}

export async function nextCaseNumber(
  tx: TenantTransaction,
  ctx: RequestContext,
): Promise<string> {
  const year = new Date().getFullYear();

  const orgRows = await tx
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, ctx.organizationId))
    .limit(1);
  const settings = (orgRows[0]?.settings ?? {}) as OrgSettings;
  const format = settings.caseNumberFormat ?? DEFAULT_FORMAT;

  // Count cases opened this year in the org (yearly sequence).
  const countRows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(cases)
    .where(
      and(
        eq(cases.organizationId, ctx.organizationId),
        sql`extract(year from ${cases.openedAt}) = ${year}`,
      ),
    );
  const seq = (countRows[0]?.n ?? 0) + 1;

  return formatCaseNumber(format, year, seq);
}
