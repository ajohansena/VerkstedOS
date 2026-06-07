import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { Vehicle } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  createVehicleSchema,
  updateVehicleSchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from '../../domain/vehicle';
import {
  insertVehicle,
  recordOwnership,
  updateVehicleRow,
} from '../../infrastructure/repositories/vehicle-repository';

/**
 * Vehicle use-cases (docs/03-data-model.md). Permission-checked, full-audited,
 * event-emitting. Ownership history is appended on creation and whenever the
 * owner, user, or ownership type changes.
 */

export async function createVehicle(
  ctx: RequestContext,
  rawInput: CreateVehicleInput,
): Promise<Vehicle> {
  await requirePermission(ctx, 'case:edit');
  const input = createVehicleSchema.parse(rawInput);

  return withTransaction(ctx, async (tx) => {
    const vehicle = await insertVehicle(tx, ctx, {
      registrationNumber: input.registrationNumber ?? null,
      vin: input.vin ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      colour: input.colour ?? null,
      ownerCustomerId: input.ownerCustomerId ?? null,
      userCustomerId: input.userCustomerId ?? null,
      ownershipType: input.ownershipType,
      leaseContractRef: input.leaseContractRef ?? null,
    });

    await recordOwnership(tx, ctx, vehicle);

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'vehicles',
      entityId: vehicle.id,
      after: {
        registrationNumber: vehicle.registrationNumber,
        ownershipType: vehicle.ownershipType,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'customer.vehicle.created',
      payload: { vehicleId: vehicle.id },
    });

    return vehicle;
  });
}

export async function updateVehicle(
  ctx: RequestContext,
  id: string,
  rawInput: UpdateVehicleInput,
): Promise<Vehicle> {
  await requirePermission(ctx, 'case:edit');
  const input = updateVehicleSchema.parse(rawInput);

  return withTransaction(ctx, async (tx) => {
    const changes: Parameters<typeof updateVehicleRow>[3] = {};
    if (input.registrationNumber !== undefined)
      changes.registrationNumber = input.registrationNumber ?? null;
    if (input.vin !== undefined) changes.vin = input.vin ?? null;
    if (input.make !== undefined) changes.make = input.make ?? null;
    if (input.model !== undefined) changes.model = input.model ?? null;
    if (input.year !== undefined) changes.year = input.year ?? null;
    if (input.colour !== undefined) changes.colour = input.colour ?? null;
    if (input.ownerCustomerId !== undefined)
      changes.ownerCustomerId = input.ownerCustomerId ?? null;
    if (input.userCustomerId !== undefined)
      changes.userCustomerId = input.userCustomerId ?? null;
    if (input.ownershipType !== undefined)
      changes.ownershipType = input.ownershipType;
    if (input.leaseContractRef !== undefined)
      changes.leaseContractRef = input.leaseContractRef ?? null;

    const vehicle = await updateVehicleRow(tx, ctx, id, changes);

    // Append ownership history only when an ownership-relevant field changed.
    const ownershipChanged =
      input.ownerCustomerId !== undefined ||
      input.userCustomerId !== undefined ||
      input.ownershipType !== undefined;
    if (ownershipChanged) {
      await recordOwnership(tx, ctx, vehicle);
    }

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'vehicles',
      entityId: id,
      after: changes,
    });

    await emitEvent(tx, ctx, {
      eventType: 'customer.vehicle.updated',
      payload: { vehicleId: id, ownershipChanged },
    });

    return vehicle;
  });
}
