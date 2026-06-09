import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { vehicleMovements } from '@/db/schemas/yard/vehicle-movements';
import { vehiclePlacements } from '@/db/schemas/yard/vehicle-placements';
import { yardLayouts } from '@/db/schemas/yard/yard-layouts';
import { yardLocations } from '@/db/schemas/yard/yard-locations';

export interface PlatformYardLayoutRow {
  readonly id: string;
  readonly organizationId: string;
  readonly workshopId: string;
  readonly code: string;
  readonly name: string;
}

export async function listPlatformYardLayouts(
  limit = 200,
  organizationId?: string,
): Promise<PlatformYardLayoutRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const base = db
    .select({
      id: yardLayouts.id,
      organizationId: yardLayouts.organizationId,
      workshopId: yardLayouts.workshopId,
      code: yardLayouts.code,
      name: yardLayouts.name,
    })
    .from(yardLayouts);
  if (organizationId) {
    return base
      .where(eq(yardLayouts.organizationId, organizationId))
      .orderBy(yardLayouts.code)
      .limit(limit);
  }
  return base.orderBy(yardLayouts.code).limit(limit);
}

export interface PlatformYardLocationRow {
  readonly id: string;
  readonly organizationId: string;
  readonly layoutId: string;
  readonly code: string;
  readonly kind: string;
  readonly status: string;
  readonly capacity: number;
  readonly qrTag: string | null;
}

export async function listPlatformYardLocations(
  limit = 500,
  organizationId?: string,
): Promise<PlatformYardLocationRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const base = db
    .select({
      id: yardLocations.id,
      organizationId: yardLocations.organizationId,
      layoutId: yardLocations.layoutId,
      code: yardLocations.code,
      kind: yardLocations.kind,
      status: yardLocations.status,
      capacity: yardLocations.capacity,
      qrTag: yardLocations.qrTag,
    })
    .from(yardLocations);
  if (organizationId) {
    return base
      .where(eq(yardLocations.organizationId, organizationId))
      .orderBy(yardLocations.code)
      .limit(limit);
  }
  return base.orderBy(yardLocations.code).limit(limit);
}

export interface PlatformVehiclePlacementRow {
  readonly id: string;
  readonly organizationId: string;
  readonly caseId: string;
  readonly locationId: string;
  readonly placedAt: Date;
}

export async function listPlatformVehiclePlacements(
  limit = 500,
  organizationId?: string,
): Promise<PlatformVehiclePlacementRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const base = db
    .select({
      id: vehiclePlacements.id,
      organizationId: vehiclePlacements.organizationId,
      caseId: vehiclePlacements.caseId,
      locationId: vehiclePlacements.locationId,
      placedAt: vehiclePlacements.placedAt,
    })
    .from(vehiclePlacements);
  if (organizationId) {
    return base
      .where(eq(vehiclePlacements.organizationId, organizationId))
      .orderBy(desc(vehiclePlacements.placedAt))
      .limit(limit);
  }
  return base
    .orderBy(desc(vehiclePlacements.placedAt))
    .limit(limit);
}

export interface PlatformVehicleMovementRow {
  readonly id: string;
  readonly organizationId: string;
  readonly caseId: string;
  readonly fromLocationId: string | null;
  readonly toLocationId: string;
  readonly reason: string;
  readonly movedAt: Date;
}

export async function listPlatformVehicleMovements(
  limit = 500,
  organizationId?: string,
): Promise<PlatformVehicleMovementRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const base = db
    .select({
      id: vehicleMovements.id,
      organizationId: vehicleMovements.organizationId,
      caseId: vehicleMovements.caseId,
      fromLocationId: vehicleMovements.fromLocationId,
      toLocationId: vehicleMovements.toLocationId,
      reason: vehicleMovements.reason,
      movedAt: vehicleMovements.movedAt,
    })
    .from(vehicleMovements);
  if (organizationId) {
    return base
      .where(eq(vehicleMovements.organizationId, organizationId))
      .orderBy(desc(vehicleMovements.movedAt))
      .limit(limit);
  }
  return base.orderBy(desc(vehicleMovements.movedAt)).limit(limit);
}
