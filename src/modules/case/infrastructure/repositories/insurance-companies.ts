import { and, asc, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import type { InsuranceCompany } from '@/db/types';
import { insuranceCompanies } from '@/db/schemas/platform/insurance-companies';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Insurance-company catalog reader.
 *
 * `insurance_companies` is a PLATFORM-SHARED, READ-ONLY catalog (no
 * `organization_id`) — see docs/03-data-model.md. Every tenant references the
 * same Fremtind / If / Gjensidige rows. The funding-source flow in the case
 * intake wizard needs to enumerate them when the user chooses `insurance` as
 * a funding kind. We expose a read-only listing here; mutations are platform-
 * only and live in `src/lib/seed/insurance-companies.ts`.
 */
export async function listInsuranceCompanies(
  ctx: RequestContext,
): Promise<InsuranceCompany[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(insuranceCompanies)
      .where(and(eq(insuranceCompanies.isActive, true)))
      .orderBy(asc(insuranceCompanies.name));
  });
}
