/**
 * Customer & Vehicle — public surface.
 *
 * The ONLY entry point other modules and the app may import from.
 */

export type { Customer, Vehicle, VehicleOwnershipHistory } from '@/db/types';

// Customer use-cases
export {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../application/services/customer-service';

export {
  type CreateCustomerInput,
  type UpdateCustomerInput,
  createCustomerSchema,
  updateCustomerSchema,
} from '../domain/customer';

// Customer reads
export {
  findCustomerById,
  searchCustomers,
  listRecentCustomers,
  countCustomers,
} from '../infrastructure/repositories/customer-repository';

// Vehicle use-cases
export {
  createVehicle,
  updateVehicle,
} from '../application/services/vehicle-service';

export {
  type CreateVehicleInput,
  type UpdateVehicleInput,
  createVehicleSchema,
  updateVehicleSchema,
} from '../domain/vehicle';

// Vehicle reads
export {
  findVehicleById,
  searchVehicles,
  listRecentVehicles,
  listVehiclesWithCaseStats,
  listOwnershipHistory,
  type VehicleWithStats,
} from '../infrastructure/repositories/vehicle-repository';

// Lookups
export {
  lookupVehicleByReg,
  vegvesenCacheStats,
  type VehicleLookupResult,
} from '../infrastructure/adapters/vegvesen-adapter';

export {
  lookupByPhone,
  type PhoneLookupResult,
} from '../infrastructure/adapters/phone-1881-adapter';
