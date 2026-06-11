/**
 * Production — narrow public sub-barrel for the transition machine.
 *
 * Exists to break the import cycle that would otherwise form between
 * `case/public` (which exports `createCase`) and `production/public`
 * (which exports `listPlannerRowsForRange`, itself a reader of
 * `case/public`). Consumers that only need to ensure / transition a
 * `ProductionOrder` import from here; the full `production/public`
 * barrel is reserved for callers that need the wider surface.
 */
export {
  ensureProductionOrder,
  ensureProductionOrderInTx,
  transitionState,
  ensureWorkflowSeeded,
  type TransitionInput,
} from '../application/services/transition-machine';
