/**
 * Workforce — public surface.
 *
 * The ONLY entry point other modules and the app may import from.
 */

export type {
  Employee,
  EmployeeSkill,
  Resource,
  ShiftDefinition,
  ClockSession,
  TimeEntry,
  AbsenceType,
  AbsenceEntry,
} from '@/db/types';

// Clock + time
export {
  clockIn,
  clockOut,
  correctTimeEntry,
} from '../application/services/clock';

// Employee management
export {
  createEmployee,
  addEmployeeSkill,
} from '../application/services/employee-management';

// Reads
export {
  listEmployees,
  findEmployeeById,
  listSkills,
  findOpenSession,
  listWorkingNow,
  listTimeEntries,
  type WorkingNow,
} from '../infrastructure/repositories/workforce-repository';

// KPI calculations (SSoT)
export {
  calculateUtilization,
  type UtilizationInput,
  type UtilizationResult,
} from '../application/calculations/utilization';
