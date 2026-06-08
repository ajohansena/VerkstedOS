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
} from '@/db/types';

// Container + transition machine
export {
  ensureProductionOrder,
  transitionState,
  ensureWorkflowSeeded,
  type TransitionInput,
} from '../application/services/transition-machine';

export { seedDefaultWorkflow } from '../application/services/seed-workflow';

// Holds
export { createHold, resolveHold } from '../application/services/holds';

// Reads
export {
  listProductionBoard,
  listStateHistory,
  listAvailableTransitions,
  listOpenHolds,
  listWorkflowStates,
  type BoardItem,
} from '../infrastructure/repositories/production-repository';
