import { z } from 'zod';

/**
 * Vehicle domain types & input validation (docs/03-data-model.md). Pure.
 */

export const ownershipTypeSchema = z.enum([
  'private',
  'leased',
  'company_pool',
  'rental',
  'unknown',
]);

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().max(16).optional(),
  vin: z.string().trim().max(32).optional(),
  make: z.string().trim().max(64).optional(),
  model: z.string().trim().max(64).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  colour: z.string().trim().max(64).optional(),
  ownerCustomerId: z.string().uuid().optional(),
  userCustomerId: z.string().uuid().optional(),
  ownershipType: ownershipTypeSchema.default('unknown'),
  leaseContractRef: z.string().trim().max(256).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
