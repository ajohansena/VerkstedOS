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
  OfficeTask,
  TaskTemplate,
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
  findEmployeeByUserId,
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

// Absence approval workflow (Sprint 18)
export {
  requestAbsence,
  approveAbsence,
  declineAbsence,
  cancelAbsence,
  listPendingAbsenceRequests,
  listAbsencesInRange,
  type RequestAbsenceInput,
} from '../application/services/absence';
export {
  ensureDefaultAbsenceTypes,
  listAbsenceTypesForOrg,
  listApprovedAbsenceWindowsForEmployees,
  type AbsenceWithEmployee,
} from '../infrastructure/repositories/absence-repository';

// Office tasks (D3 Phase B)
export {
  createOfficeTask,
  assignOfficeTask,
  startOfficeTask,
  completeOfficeTask,
  cancelOfficeTask,
  OfficeTaskValidationError,
  type CreateOfficeTaskInput,
  type AssignOfficeTaskInput,
  type OfficeTaskKind,
  type OfficeTaskPriority,
} from '../application/services/office-tasks';
export {
  findOfficeTaskById,
  listOfficeTasksForCase,
  listMyOpenOfficeTasks,
  listOpenOfficeTasksForWorkshop,
  listOpenOfficeTasksForOrg,
} from '../infrastructure/repositories/office-task-repository';
export {
  calculateOpenOfficeTaskSummary,
  type OpenOfficeTaskRow,
  type OpenOfficeTaskSummary,
} from '../application/calculations/office-tasks';

// Task templates (D3 Phase F)
export {
  createTaskTemplate,
  listTaskTemplates,
  listActiveTaskTemplatesForEvent,
  setTaskTemplateActive,
  evaluateAndGenerate,
  matchesFilter,
  renderTemplate,
  TaskTemplateValidationError,
  type CreateTaskTemplateInput,
  type TaskTemplateDueReference,
  type TriggerEvent,
  type GenerationResult,
} from '../application/services/task-templates';
