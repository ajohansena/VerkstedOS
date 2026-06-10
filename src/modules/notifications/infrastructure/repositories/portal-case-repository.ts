/**
 * Customer portal read helper (Sprint 17). Reads a single case's status for
 * the unauth'd portal route. Uses the admin client — the portal token is the
 * credential and resolution has already verified it. The reads are minimal:
 * case number, status, workshop, vehicle. No financial detail, no
 * cross-customer info. Org-scoping is implicit (we look up by the case id
 * that the token points at).
 */

import { eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { workshops } from '@/db/schemas/identity/workshops';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import { productionOrders } from '@/db/schemas/production/production-orders';

export interface PortalCaseView {
  caseNumber: string;
  status: string;
  workshopName: string | null;
  vehicleLabel: string | null;
  registrationNumber: string | null;
  productionStateLabel: string | null;
  openedAt: string;
  expectedReadyAt: string | null;
}

/** Normal repair span used as the synthetic delivery promise (see kpi-snapshot). */
const NORMAL_REPAIR_DAYS = 12;
const DAY_MS = 86400000;

export async function readPortalCase(
  caseId: string,
): Promise<PortalCaseView | null> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db
    .select({
      caseNumber: cases.caseNumber,
      status: cases.status,
      openedAt: cases.openedAt,
      workshopName: workshops.name,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      registrationNumber: vehicles.registrationNumber,
      stateLabel: workflowStates.label,
    })
    .from(cases)
    .leftJoin(workshops, eq(workshops.id, cases.currentWorkshopId))
    .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
    .leftJoin(productionOrders, eq(productionOrders.caseId, cases.id))
    .leftJoin(
      workflowStates,
      eq(workflowStates.id, productionOrders.currentStateId),
    )
    .where(eq(cases.id, caseId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const expected = new Date(
    row.openedAt.getTime() + NORMAL_REPAIR_DAYS * DAY_MS,
  );
  return {
    caseNumber: row.caseNumber,
    status: row.status,
    workshopName: row.workshopName ?? null,
    vehicleLabel:
      [row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ') || null,
    registrationNumber: row.registrationNumber ?? null,
    productionStateLabel: row.stateLabel ?? null,
    openedAt: row.openedAt.toISOString(),
    expectedReadyAt: expected.toISOString(),
  };
}
