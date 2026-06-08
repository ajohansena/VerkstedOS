import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { vehicleOwnershipHistory } from '@/db/schemas/customer/vehicle-ownership-history';
import { vehicles } from '@/db/schemas/customer/vehicles';
import type { Vehicle, VehicleOwnershipHistory } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Vehicle repository (org-scoped) + ownership-history projection. Every query
 * filters by `organization_id` explicitly; RLS is the backstop.
 */

export async function insertVehicle(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: {
    registrationNumber?: string | null;
    vin?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    colour?: string | null;
    ownerCustomerId?: string | null;
    userCustomerId?: string | null;
    ownershipType: Vehicle['ownershipType'];
    leaseContractRef?: string | null;
  },
): Promise<Vehicle> {
  const rows = await tx
    .insert(vehicles)
    .values({
      organizationId: ctx.organizationId,
      registrationNumber: values.registrationNumber ?? null,
      vin: values.vin ?? null,
      make: values.make ?? null,
      model: values.model ?? null,
      year: values.year ?? null,
      colour: values.colour ?? null,
      ownerCustomerId: values.ownerCustomerId ?? null,
      userCustomerId: values.userCustomerId ?? null,
      ownershipType: values.ownershipType,
      leaseContractRef: values.leaseContractRef ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const vehicle = rows[0];
  if (!vehicle) throw new Error('Failed to insert vehicle');
  return vehicle;
}

/** Append an ownership-history row (called whenever owner/user/type changes). */
export async function recordOwnership(
  tx: TenantTransaction,
  ctx: RequestContext,
  vehicle: Pick<
    Vehicle,
    'id' | 'ownerCustomerId' | 'userCustomerId' | 'ownershipType'
  >,
): Promise<void> {
  await tx.insert(vehicleOwnershipHistory).values({
    organizationId: ctx.organizationId,
    vehicleId: vehicle.id,
    ownerCustomerId: vehicle.ownerCustomerId,
    userCustomerId: vehicle.userCustomerId,
    ownershipType: vehicle.ownershipType,
    recordedByUserId: ctx.userId,
  });
}

export async function findVehicleById(
  ctx: RequestContext,
  id: string,
): Promise<Vehicle | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, id),
          eq(vehicles.organizationId, ctx.organizationId),
          isNull(vehicles.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/** Search by registration number or VIN. */
export async function searchVehicles(
  ctx: RequestContext,
  query: string,
  limit = 25,
): Promise<Vehicle[]> {
  const like = `%${query.trim()}%`;
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.organizationId, ctx.organizationId),
          isNull(vehicles.deletedAt),
          or(
            ilike(vehicles.registrationNumber, like),
            ilike(vehicles.vin, like),
          ),
        ),
      )
      .orderBy(vehicles.registrationNumber)
      .limit(limit);
  });
}

export async function updateVehicleRow(
  tx: TenantTransaction,
  ctx: RequestContext,
  id: string,
  changes: Partial<{
    registrationNumber: string | null;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    colour: string | null;
    ownerCustomerId: string | null;
    userCustomerId: string | null;
    ownershipType: Vehicle['ownershipType'];
    leaseContractRef: string | null;
  }>,
): Promise<Vehicle> {
  const rows = await tx
    .update(vehicles)
    .set({ ...changes, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.organizationId, ctx.organizationId),
        isNull(vehicles.deletedAt),
      ),
    )
    .returning();
  const vehicle = rows[0];
  if (!vehicle) throw new Error(`Vehicle ${id} not found`);
  return vehicle;
}

/** Ownership history for a vehicle, newest first. */
export async function listOwnershipHistory(
  ctx: RequestContext,
  vehicleId: string,
): Promise<VehicleOwnershipHistory[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(vehicleOwnershipHistory)
      .where(
        and(
          eq(vehicleOwnershipHistory.organizationId, ctx.organizationId),
          eq(vehicleOwnershipHistory.vehicleId, vehicleId),
        ),
      )
      .orderBy(desc(vehicleOwnershipHistory.effectiveFrom));
  });
}

export async function listRecentVehicles(
  ctx: RequestContext,
  limit = 25,
): Promise<Vehicle[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.organizationId, ctx.organizationId),
          isNull(vehicles.deletedAt),
        ),
      )
      .orderBy(desc(vehicles.updatedAt))
      .limit(limit);
  });
}

export interface VehicleWithStats {
  vehicle: Vehicle;
  activeCaseCount: number;
  lastVisitAt: Date | null;
}

/**
 * Rich vehicle list for the /vehicles surface (Sprint 14 Track G): each row
 * carries its active-case count and last visit (most recent case openedAt).
 * Optionally filtered by a reg/VIN search term.
 */
export async function listVehiclesWithCaseStats(
  ctx: RequestContext,
  search?: string,
  limit = 50,
): Promise<VehicleWithStats[]> {
  return withTransaction(ctx, async (tx) => {
    const term = search?.trim();
    const baseWhere = and(
      eq(vehicles.organizationId, ctx.organizationId),
      isNull(vehicles.deletedAt),
      term
        ? or(
            ilike(vehicles.registrationNumber, `%${term}%`),
            ilike(vehicles.vin, `%${term}%`),
          )
        : undefined,
    );

    const vehicleRows = await tx
      .select()
      .from(vehicles)
      .where(baseWhere)
      .orderBy(desc(vehicles.updatedAt))
      .limit(limit);

    if (vehicleRows.length === 0) return [];
    const ids = vehicleRows.map((v) => v.id);

    const statRows = await tx
      .select({
        vehicleId: cases.vehicleId,
        activeCount: sql<number>`count(*) filter (where ${cases.status} not in ('delivered','closed','cancelled'))::int`,
        lastVisit: sql<Date | null>`max(${cases.openedAt})`,
      })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          inArray(cases.vehicleId, ids),
          isNull(cases.deletedAt),
        ),
      )
      .groupBy(cases.vehicleId);

    const statByVehicle = new Map<
      string,
      { activeCount: number; lastVisit: Date | null }
    >();
    for (const row of statRows) {
      if (row.vehicleId) {
        statByVehicle.set(row.vehicleId, {
          activeCount: Number(row.activeCount),
          lastVisit: row.lastVisit ? new Date(row.lastVisit) : null,
        });
      }
    }

    return vehicleRows.map((v) => {
      const stat = statByVehicle.get(v.id);
      return {
        vehicle: v,
        activeCaseCount: stat?.activeCount ?? 0,
        lastVisitAt: stat?.lastVisit ?? null,
      };
    });
  });
}
