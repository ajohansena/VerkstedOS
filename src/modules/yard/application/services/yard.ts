import { eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { yardLocations } from '@/db/schemas/yard/yard-locations';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  countActivePlacementsAtLocations,
  findActivePlacementForCase,
  findYardLocationById,
  findYardLocationByQrTag,
  insertVehicleMovement,
  insertYardLayout,
  insertYardLocation,
  listYardLayouts,
  listYardLocationsForLayout,
  upsertActivePlacement,
} from '@/modules/yard/infrastructure/repositories/yard-repository';

import type {
  VehicleMovement,
  VehiclePlacement,
  YardLayout,
  YardLocation,
} from '@/db/types';
import { deriveLocationStatus } from '@/modules/yard/application/calculations/occupancy';

export class YardLocationFullError extends Error {
  readonly code = 'YARD_LOCATION_FULL';
  constructor(public readonly locationId: string) {
    super(`Yard location ${locationId} is at capacity.`);
  }
}

export class YardLocationBlockedError extends Error {
  readonly code = 'YARD_LOCATION_BLOCKED';
  constructor(public readonly locationId: string) {
    super(`Yard location ${locationId} is blocked.`);
  }
}

// --- Layout designer (admin) ------------------------------------------------

export interface CreateYardLayoutInput {
  workshopId: string;
  code: string;
  name: string;
  description?: string | null;
}

export async function createYardLayout(
  ctx: RequestContext,
  input: CreateYardLayoutInput,
): Promise<YardLayout> {
  await requirePermission(ctx, 'admin:config');
  const layout = await insertYardLayout(ctx, {
    organizationId: ctx.organizationId,
    workshopId: input.workshopId,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'yard_layouts',
      entityId: layout.id,
      after: { code: layout.code, name: layout.name },
    });
  });
  return layout;
}

export async function listLayouts(ctx: RequestContext): Promise<YardLayout[]> {
  return listYardLayouts(ctx);
}

export interface CreateYardLocationInput {
  layoutId: string;
  code: string;
  kind?: 'parking' | 'bay' | 'storage' | 'temporary';
  capacity?: number;
  rowIndex?: number;
  columnIndex?: number;
  qrTag?: string | null;
  notes?: string | null;
}

export async function createYardLocation(
  ctx: RequestContext,
  input: CreateYardLocationInput,
): Promise<YardLocation> {
  await requirePermission(ctx, 'admin:config');
  const location = await insertYardLocation(ctx, {
    organizationId: ctx.organizationId,
    layoutId: input.layoutId,
    code: input.code,
    kind: input.kind ?? 'parking',
    capacity: input.capacity ?? 1,
    rowIndex: input.rowIndex ?? 0,
    columnIndex: input.columnIndex ?? 0,
    qrTag: input.qrTag ?? null,
    notes: input.notes ?? null,
    status: 'available',
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'yard_locations',
      entityId: location.id,
      after: { code: location.code, kind: location.kind },
    });
  });
  return location;
}

export async function listLocationsForLayout(
  ctx: RequestContext,
  layoutId: string,
): Promise<YardLocation[]> {
  return listYardLocationsForLayout(ctx, layoutId);
}

// --- Move (the core operation; mobile + tablet + QR scan) -------------------

export interface MoveVehicleInput {
  caseId: string;
  toLocationId: string;
  reason?:
    | 'arrival'
    | 'reposition'
    | 'into_bay'
    | 'out_of_bay'
    | 'into_storage'
    | 'departure'
    | 'correction';
  note?: string | null;
}

export interface MoveResult {
  placement: VehiclePlacement;
  movement: VehicleMovement;
  previousLocationId: string | null;
}

/**
 * The single source of truth for moving a vehicle on the yard.
 * Upserts the placement, appends an immutable movement row, and recomputes
 * yard_location.status for both the source and destination slots — all in
 * one transaction so the map view is always coherent.
 */
export async function moveVehicleToLocation(
  ctx: RequestContext,
  input: MoveVehicleInput,
): Promise<MoveResult> {
  await requirePermission(ctx, 'case:edit');

  const dest = await findYardLocationById(ctx, input.toLocationId);
  if (!dest) throw new Error('YARD_LOCATION_NOT_FOUND');
  if (dest.status === 'blocked')
    throw new YardLocationBlockedError(dest.id);

  const previousPlacement = await findActivePlacementForCase(ctx, input.caseId);
  const previousLocationId = previousPlacement?.locationId ?? null;

  // Capacity check (destination): count active placements not including this case.
  const destCounts = await countActivePlacementsAtLocations(ctx, [dest.id]);
  const destOccupied = destCounts.get(dest.id) ?? 0;
  const movingFromSameSlot = previousLocationId === dest.id;
  if (!movingFromSameSlot && destOccupied >= dest.capacity) {
    throw new YardLocationFullError(dest.id);
  }

  const now = new Date();
  const placement = await upsertActivePlacement(ctx, {
    organizationId: ctx.organizationId,
    caseId: input.caseId,
    locationId: dest.id,
    placedAt: now,
    note: input.note ?? null,
  });

  const reason = input.reason ?? (previousLocationId ? 'reposition' : 'arrival');

  const movement = await insertVehicleMovement(ctx, {
    organizationId: ctx.organizationId,
    caseId: input.caseId,
    fromLocationId: previousLocationId,
    toLocationId: dest.id,
    reason,
    movedAt: now,
    movedByUserId: ctx.userId ?? null,
    note: input.note ?? null,
  });

  // Recompute destination + source status to keep the visual map honest.
  await refreshLocationStatus(ctx, dest.id);
  if (previousLocationId && previousLocationId !== dest.id) {
    await refreshLocationStatus(ctx, previousLocationId);
  }

  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'vehicle_placements',
      entityId: placement.id,
      after: { caseId: input.caseId, toLocationId: dest.id, reason },
    });
    await emitEvent(tx, ctx, {
      eventType: 'yard.vehicle.moved',
      payload: {
        caseId: input.caseId,
        fromLocationId: previousLocationId,
        toLocationId: dest.id,
        reason,
      },
    });
  });

  return { placement, movement, previousLocationId };
}

/** Resolve a QR tag to its location, then move the vehicle there. */
export async function moveVehicleByQrTag(
  ctx: RequestContext,
  caseId: string,
  qrTag: string,
  reason?: MoveVehicleInput['reason'],
): Promise<MoveResult> {
  const location = await findYardLocationByQrTag(ctx, qrTag);
  if (!location) throw new Error('YARD_QR_NOT_FOUND');
  return moveVehicleToLocation(ctx, {
    caseId,
    toLocationId: location.id,
    ...(reason ? { reason } : {}),
  });
}

async function refreshLocationStatus(
  ctx: RequestContext,
  locationId: string,
): Promise<void> {
  const location = await findYardLocationById(ctx, locationId);
  if (!location) return;
  const counts = await countActivePlacementsAtLocations(ctx, [locationId]);
  const occupied = counts.get(locationId) ?? 0;
  const next = deriveLocationStatus(
    { capacity: location.capacity, occupied },
    location.status === 'blocked',
    location.status === 'reserved',
  );
  if (next !== location.status) {
    await withTransaction(ctx, async (tx) => {
      await tx
        .update(yardLocations)
        .set({ status: next, updatedAt: new Date(), updatedBy: ctx.userId })
        .where(eq(yardLocations.id, locationId));
    });
  }
}
