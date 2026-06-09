import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { vehicleMovements } from '@/db/schemas/yard/vehicle-movements';
import { vehiclePlacements } from '@/db/schemas/yard/vehicle-placements';
import { yardLayouts } from '@/db/schemas/yard/yard-layouts';
import { yardLocations } from '@/db/schemas/yard/yard-locations';
import type {
  NewVehicleMovement,
  NewVehiclePlacement,
  NewYardLayout,
  NewYardLocation,
  VehicleMovement,
  VehiclePlacement,
  YardLayout,
  YardLocation,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

// --- Layouts ----------------------------------------------------------------

export async function insertYardLayout(
  ctx: RequestContext,
  input: NewYardLayout,
): Promise<YardLayout> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(yardLayouts)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function listYardLayouts(
  ctx: RequestContext,
): Promise<YardLayout[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(yardLayouts)
      .where(
        and(
          eq(yardLayouts.organizationId, ctx.organizationId),
          isNull(yardLayouts.deletedAt),
        ),
      )
      .orderBy(asc(yardLayouts.code));
  });
}

// --- Locations --------------------------------------------------------------

export async function insertYardLocation(
  ctx: RequestContext,
  input: NewYardLocation,
): Promise<YardLocation> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(yardLocations)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function listYardLocationsForLayout(
  ctx: RequestContext,
  layoutId: string,
): Promise<YardLocation[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(yardLocations)
      .where(
        and(
          eq(yardLocations.organizationId, ctx.organizationId),
          eq(yardLocations.layoutId, layoutId),
          isNull(yardLocations.deletedAt),
        ),
      )
      .orderBy(asc(yardLocations.rowIndex), asc(yardLocations.columnIndex));
  });
}

export async function findYardLocationById(
  ctx: RequestContext,
  id: string,
): Promise<YardLocation | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(yardLocations)
      .where(
        and(
          eq(yardLocations.id, id),
          eq(yardLocations.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findYardLocationByQrTag(
  ctx: RequestContext,
  qrTag: string,
): Promise<YardLocation | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(yardLocations)
      .where(
        and(
          eq(yardLocations.qrTag, qrTag),
          eq(yardLocations.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function setYardLocationStatus(
  ctx: RequestContext,
  id: string,
  status: 'available' | 'occupied' | 'reserved' | 'blocked',
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(yardLocations)
      .set({ status, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(yardLocations.id, id),
          eq(yardLocations.organizationId, ctx.organizationId),
        ),
      );
  });
}

// --- Placements -------------------------------------------------------------

export async function findActivePlacementForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<VehiclePlacement | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(vehiclePlacements)
      .where(
        and(
          eq(vehiclePlacements.caseId, caseId),
          eq(vehiclePlacements.organizationId, ctx.organizationId),
          isNull(vehiclePlacements.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function upsertActivePlacement(
  ctx: RequestContext,
  input: NewVehiclePlacement,
): Promise<VehiclePlacement> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(vehiclePlacements)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: vehiclePlacements.caseId,
        set: {
          locationId: input.locationId,
          placedAt: input.placedAt ?? new Date(),
          note: input.note ?? null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        },
      })
      .returning();
    return rows[0]!;
  });
}

export async function listActivePlacementsForOrg(
  ctx: RequestContext,
): Promise<
  Array<{
    placement: VehiclePlacement;
    locationCode: string;
    layoutId: string;
    caseNumber: string;
    registrationNumber: string | null;
  }>
> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        placement: vehiclePlacements,
        locationCode: yardLocations.code,
        layoutId: yardLocations.layoutId,
        caseNumber: cases.caseNumber,
        registrationNumber: vehicles.registrationNumber,
      })
      .from(vehiclePlacements)
      .innerJoin(yardLocations, eq(yardLocations.id, vehiclePlacements.locationId))
      .innerJoin(cases, eq(cases.id, vehiclePlacements.caseId))
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .where(
        and(
          eq(vehiclePlacements.organizationId, ctx.organizationId),
          isNull(vehiclePlacements.deletedAt),
        ),
      )
      .orderBy(asc(cases.caseNumber));
    return rows;
  });
}

export async function countActivePlacementsAtLocations(
  ctx: RequestContext,
  locationIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (locationIds.length === 0) return counts;
  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ locationId: vehiclePlacements.locationId })
      .from(vehiclePlacements)
      .where(
        and(
          eq(vehiclePlacements.organizationId, ctx.organizationId),
          inArray(vehiclePlacements.locationId, locationIds as string[]),
          isNull(vehiclePlacements.deletedAt),
        ),
      );
    for (const row of rows) {
      counts.set(row.locationId, (counts.get(row.locationId) ?? 0) + 1);
    }
  });
  return counts;
}

// --- Movements (append-only) ------------------------------------------------

export async function insertVehicleMovement(
  ctx: RequestContext,
  input: NewVehicleMovement,
): Promise<VehicleMovement> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(vehicleMovements)
      .values({
        ...input,
        organizationId: ctx.organizationId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function listVehicleMovementsForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<VehicleMovement[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(vehicleMovements)
      .where(
        and(
          eq(vehicleMovements.caseId, caseId),
          eq(vehicleMovements.organizationId, ctx.organizationId),
        ),
      )
      .orderBy(desc(vehicleMovements.movedAt));
  });
}
