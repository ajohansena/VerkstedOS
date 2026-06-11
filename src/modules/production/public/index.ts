/**
 * Production — public surface.
 *
 * The ONLY entry point other modules and the app may import from.
 *
 * GUARDRAIL: status is a projection; ProductionOrder is a container; workflow
 * states are configurable data, not the source of production truth. Segment/
 * clock activity becomes the primary driver in Sprint 10 via the same machine.
 */

export type {
  ProductionOrder,
  ProductionStateHistory,
  ProductionHold,
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  WorkSegment,
  ResourceAssignment,
  Task,
} from '@/db/types';

// Container + transition machine
export {
  ensureProductionOrder,
  ensureProductionOrderInTx,
  transitionState,
  ensureWorkflowSeeded,
  type TransitionInput,
} from '../application/services/transition-machine';

export { seedDefaultWorkflow } from '../application/services/seed-workflow';

// Holds
export { createHold, resolveHold } from '../application/services/holds';

// Work segments
export {
  addWorkSegment,
  listWorkSegments,
} from '../application/services/work-segments';

// Segment-driven progress (the guardrail activation)
export {
  markSegmentActive,
  completeSegment,
} from '../application/services/segment-progress';

// Resource assignment + conflict detection
export {
  assignResource,
  listAssignments,
  ResourceConflictError,
  type AssignInput,
} from '../application/services/resource-assignment';

// Capacity calculations (SSoT)
export {
  computeCapacity,
  segmentRemainingMinutes,
  remainingWorkMinutes,
  classifyFeasibility,
  absenceMinutesInDay,
  type CapacityResult,
  type Feasibility,
  type AbsenceWindow,
} from '../application/calculations/capacity';

// KPI calculations (SSoT)
export {
  calculateThroughput,
  calculateAverageCycleTime,
  calculateOnTimeDeliveryRate,
  type DeliveredCase,
  type CycleTimeResult,
  type OnTimeResult,
} from '../application/calculations/kpi-metrics';

// Reads
export {
  listProductionBoard,
  listProductionBoardRich,
  listActiveHoldsForOrg,
  listStateHistory,
  listAvailableTransitions,
  listOpenHolds,
  listWorkflowStates,
  listWorkflowAdjacency,
  findCaseProductionState,
  listPlannedSegmentsForRange,
  listResourcesForBoard,
  type BoardItem,
  type RichBoardItem,
  type OrgHold,
  type PlannedSegmentRow,
  type ResourceRow,
} from '../infrastructure/repositories/production-repository';
