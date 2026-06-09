/**
 * Rental — public surface (Sprint 18).
 * The ONLY entry point other modules and the app may import from.
 */

export type {
  RentalVehicle,
  RentalReservation,
  RentalAgreement,
  RentalReturn,
} from '@/db/types';

export {
  registerRentalVehicle,
  createReservation,
  activateReservation,
  completeReservation,
  cancelReservation,
  createAgreement,
  signAgreement,
  recordReturn,
  RentalConflictError,
  type CreateVehicleInput,
  type CreateReservationInput,
  type CreateAgreementInput,
  type RecordReturnInput,
} from '../application/services/rental';

export {
  listRentalVehicles,
  findRentalVehicleById,
  listActiveReservationsForOrg,
  listReservationsForVehicleInRange,
  findAgreementByReservation,
  findReturnByAgreement,
} from '../infrastructure/repositories/rental-repository';

export {
  hasConflict,
  projectAvailability,
  type RentalWindow,
  type ReservationRow,
  type AvailabilityDay,
} from '../application/calculations/availability';
