import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
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
