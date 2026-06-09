/**
 * Yard module — public API.
 * Cross-module imports MUST go through this barrel.
 */

export {
  createYardLayout,
  createYardLocation,
  listLayouts,
  listLocationsForLayout,
  moveVehicleByQrTag,
  moveVehicleToLocation,
  YardLocationBlockedError,
  YardLocationFullError,
} from '@/modules/yard/application/services/yard';
export type {
  CreateYardLayoutInput,
  CreateYardLocationInput,
  MoveResult,
  MoveVehicleInput,
} from '@/modules/yard/application/services/yard';

export {
  countActivePlacementsAtLocations,
  findActivePlacementForCase,
  findYardLocationById,
  findYardLocationByQrTag,
  listActivePlacementsForOrg,
  listVehicleMovementsForCase,
  listYardLayouts,
  listYardLocationsForLayout,
} from '@/modules/yard/infrastructure/repositories/yard-repository';

export {
  deriveLocationStatus,
  summarizeOccupancy,
} from '@/modules/yard/application/calculations/occupancy';
export type {
  OccupancyLine,
  OccupancySummary,
} from '@/modules/yard/application/calculations/occupancy';
