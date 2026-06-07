import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { caseFundingSources } from '@/db/schemas/case/case-funding-sources';
import { caseParties } from '@/db/schemas/case/case-parties';
import { cases } from '@/db/schemas/case/cases';
import { customers } from '@/db/schemas/customer/customers';
import { insuranceClaims } from '@/db/schemas/case/insurance-claims';
import { vehicles } from '@/db/schemas/customer/vehicles';
import type {
  Case,
  CaseFundingSource,
  CaseParty,
  InsuranceClaim,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Case repository (org-scoped). Writes take a transaction (composed by the
 * intake service); reads open their own tenant transaction.
 */

export async function insertCase(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: {
    caseNumber: string;
    vehicleId?: string | null;
    primaryCustomerId?: string | null;
    incidentTag?: string | null;
    currentWorkshopId?: string | null;
    parentCaseId?: string | null;
  },
): Promise<Case> {
  const rows = await tx
    .insert(cases)
    .values({
      organizationId: ctx.organizationId,
      caseNumber: values.caseNumber,
      vehicleId: values.vehicleId ?? null,
      primaryCustomerId: values.primaryCustomerId ?? null,
      incidentTag: values.incidentTag ?? null,
      currentWorkshopId: values.currentWorkshopId ?? ctx.workshopId ?? null,
      parentCaseId: values.parentCaseId ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const created = rows[0];
  if (!created) throw new Error('Failed to insert case');
  return created;
}

export async function insertInsuranceClaim(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: { claimNumber?: string | null; insuranceCompanyId?: string | null },
): Promise<InsuranceClaim> {
  const rows = await tx
    .insert(insuranceClaims)
    .values({
      organizationId: ctx.organizationId,
      claimNumber: values.claimNumber ?? null,
      insuranceCompanyId: values.insuranceCompanyId ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const claim = rows[0];
  if (!claim) throw new Error('Failed to insert insurance claim');
  return claim;
}

export interface FundingSourceRow {
  kind: CaseFundingSource['kind'];
  label: string;
  insuranceClaimId?: string | null;
  payerCustomerId?: string | null;
  payerInsuranceId?: string | null;
  deductibleAmount?: string | null;
  deductiblePayerCustomerId?: string | null;
  coverageCapAmount?: string | null;
  referencesCaseId?: string | null;
  reworkReason?: string | null;
  reworkOwnerWorkshopId?: string | null;
  notes?: string | null;
}

export async function insertFundingSource(
  tx: TenantTransaction,
  ctx: RequestContext,
  caseId: string,
  sequenceNo: number,
  values: FundingSourceRow,
): Promise<CaseFundingSource> {
  const rows = await tx
    .insert(caseFundingSources)
    .values({
      organizationId: ctx.organizationId,
      caseId,
      sequenceNo,
      kind: values.kind,
      label: values.label,
      insuranceClaimId: values.insuranceClaimId ?? null,
      payerCustomerId: values.payerCustomerId ?? null,
      payerInsuranceId: values.payerInsuranceId ?? null,
      deductibleAmount: values.deductibleAmount ?? null,
      deductiblePayerCustomerId: values.deductiblePayerCustomerId ?? null,
      coverageCapAmount: values.coverageCapAmount ?? null,
      referencesCaseId: values.referencesCaseId ?? null,
      reworkReason: values.reworkReason ?? null,
      reworkOwnerWorkshopId: values.reworkOwnerWorkshopId ?? null,
      notes: values.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const fs = rows[0];
  if (!fs) throw new Error('Failed to insert funding source');
  return fs;
}

export async function findCaseById(
  ctx: RequestContext,
  id: string,
): Promise<Case | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.id, id),
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listFundingSources(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseFundingSource[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(caseFundingSources)
      .where(
        and(
          eq(caseFundingSources.organizationId, ctx.organizationId),
          eq(caseFundingSources.caseId, caseId),
          isNull(caseFundingSources.deletedAt),
        ),
      )
      .orderBy(caseFundingSources.sequenceNo);
  });
}

export async function listCaseParties(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseParty[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(caseParties)
      .where(
        and(
          eq(caseParties.organizationId, ctx.organizationId),
          eq(caseParties.caseId, caseId),
          isNull(caseParties.deletedAt),
        ),
      );
  });
}

export interface CaseListItem {
  readonly id: string;
  readonly caseNumber: string;
  readonly status: Case['status'];
  readonly registrationNumber: string | null;
  readonly customerName: string | null;
  readonly openedAt: Date;
}

/** Search by case number, claim number, vehicle reg, or customer name. */
export async function searchCases(
  ctx: RequestContext,
  query: string,
  limit = 25,
): Promise<CaseListItem[]> {
  const like = `%${query.trim()}%`;
  return withTransaction(ctx, async (tx) => {
    return tx
      .selectDistinctOn([cases.openedAt, cases.id], {
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        registrationNumber: vehicles.registrationNumber,
        customerName: customers.name,
        openedAt: cases.openedAt,
      })
      .from(cases)
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
      .leftJoin(
        caseFundingSources,
        and(
          eq(caseFundingSources.caseId, cases.id),
          isNull(caseFundingSources.deletedAt),
        ),
      )
      .leftJoin(
        insuranceClaims,
        eq(insuranceClaims.id, caseFundingSources.insuranceClaimId),
      )
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
          or(
            ilike(cases.caseNumber, like),
            ilike(vehicles.registrationNumber, like),
            ilike(customers.name, like),
            ilike(insuranceClaims.claimNumber, like),
          ),
        ),
      )
      .orderBy(desc(cases.openedAt))
      .limit(limit);
  });
}

export async function listRecentCases(
  ctx: RequestContext,
  limit = 25,
): Promise<CaseListItem[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        registrationNumber: vehicles.registrationNumber,
        customerName: customers.name,
        openedAt: cases.openedAt,
      })
      .from(cases)
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      )
      .orderBy(desc(cases.openedAt))
      .limit(limit);
  });
}

/** Count of live cases (overview). */
export async function countCases(ctx: RequestContext): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      );
    return rows[0]?.n ?? 0;
  });
}
