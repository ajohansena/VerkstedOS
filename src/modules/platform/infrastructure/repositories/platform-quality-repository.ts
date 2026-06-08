import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { checklistRuns } from '@/db/schemas/quality/checklist-runs';
import { qualityDeviations } from '@/db/schemas/quality/quality-deviations';
import { calculateQcFailureRate } from '@/modules/quality/public';

/**
 * Quality inspection (Dev surface, /dev/quality). Cross-org → service-role
 * connection. Lists recent checklist runs + open deviations for an org and
 * computes the QC failure rate via the SAME canonical calculation customer
 * code uses (SSoT — no divergent metric).
 */

export interface QcRunRow {
  readonly id: string;
  readonly caseId: string;
  readonly status: string;
  readonly signedOffAt: Date | null;
}

export interface QcOrgSummary {
  runs: QcRunRow[];
  failureRate: number;
  openDeviations: number;
}

export async function qcSummaryForOrg(
  organizationId: string,
  limit = 100,
): Promise<QcOrgSummary> {
  const db = getRawClient({ as: 'platform-inspector' });

  const runs = await db
    .select({
      id: checklistRuns.id,
      caseId: checklistRuns.caseId,
      status: checklistRuns.status,
      signedOffAt: checklistRuns.signedOffAt,
    })
    .from(checklistRuns)
    .where(eq(checklistRuns.organizationId, organizationId))
    .orderBy(desc(checklistRuns.createdAt))
    .limit(limit);

  const failure = calculateQcFailureRate(
    runs.map((r) => ({ status: r.status as never })),
  );

  const open = await db
    .select({ id: qualityDeviations.id })
    .from(qualityDeviations)
    .where(eq(qualityDeviations.organizationId, organizationId));

  return {
    runs,
    failureRate: failure.rate,
    openDeviations: open.length,
  };
}
