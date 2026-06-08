/**
 * Default Norwegian collision-repair workflow (docs/10-production-domain.md).
 *
 * Workflow is DATA (ADR-006). This is the seeded DEFAULT every org receives and
 * may customize. States carry a CATEGORY (active / waiting / terminal) that
 * drives behavior. Transitions are mostly manual in the MVP; `event_driven`
 * transitions are where WorkSegment/clock activity will drive the status
 * projection in Sprint 10 (the guardrail).
 *
 * IMPORTANT: these states are AVAILABLE, not mandatory. A small repair uses a
 * handful; a large repair uses many. Nothing forces a case through every state.
 */

export type StateCategory = 'active' | 'waiting' | 'terminal';

export interface DefaultStateDef {
  code: string;
  label: string;
  category: StateCategory;
  colorHint: 'green' | 'yellow' | 'red' | 'grey';
  isInitial?: boolean;
}

export interface DefaultTransitionDef {
  from: string;
  to: string;
  trigger: 'manual' | 'automatic' | 'event_driven';
  eventType?: string;
  requiredPermissions?: string[];
}

export const DEFAULT_WORKFLOW_NAME = 'Standard kollisjonsreparasjon';

export const DEFAULT_WORKFLOW_STATES: readonly DefaultStateDef[] = [
  {
    code: 'received',
    label: 'Mottatt',
    category: 'active',
    colorHint: 'green',
    isInitial: true,
  },
  {
    code: 'estimated',
    label: 'Taksert',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'approved',
    label: 'Godkjent',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'awaiting_parts',
    label: 'Venter på deler',
    category: 'waiting',
    colorHint: 'yellow',
  },
  {
    code: 'awaiting_approval',
    label: 'Venter på godkjenning',
    category: 'waiting',
    colorHint: 'yellow',
  },
  {
    code: 'awaiting_customer',
    label: 'Venter på kunde',
    category: 'waiting',
    colorHint: 'yellow',
  },
  {
    code: 'ready_for_disassembly',
    label: 'Klar for demontering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_disassembly',
    label: 'Under demontering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_structural_repair',
    label: 'Under rammerette',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_body_repair',
    label: 'Under karosseri',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_paint_preparation',
    label: 'Under lakkforberedelse',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_paint_application',
    label: 'Under lakkering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_paint_cure',
    label: 'Under herding',
    category: 'waiting',
    colorHint: 'yellow',
  },
  {
    code: 'in_assembly',
    label: 'Under montering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_calibration',
    label: 'Under kalibrering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_quality_control',
    label: 'Under kvalitetskontroll',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'in_rework',
    label: 'Under omarbeid',
    category: 'active',
    colorHint: 'red',
  },
  {
    code: 'ready_for_delivery',
    label: 'Klar for levering',
    category: 'active',
    colorHint: 'green',
  },
  {
    code: 'delivered',
    label: 'Levert',
    category: 'terminal',
    colorHint: 'grey',
  },
  {
    code: 'cancelled',
    label: 'Kansellert',
    category: 'terminal',
    colorHint: 'grey',
  },
  {
    code: 'total_loss',
    label: 'Kondemnert',
    category: 'terminal',
    colorHint: 'grey',
  },
];

/**
 * Key transitions. Not exhaustive of every possible move — the MVP seeds the
 * common collision-repair path plus the waiting/terminal escapes. Orgs add more
 * via the workflow editor. `production:transition` gates manual moves.
 */
export const DEFAULT_WORKFLOW_TRANSITIONS: readonly DefaultTransitionDef[] = [
  { from: 'received', to: 'estimated', trigger: 'manual' },
  { from: 'estimated', to: 'approved', trigger: 'manual' },
  { from: 'estimated', to: 'awaiting_approval', trigger: 'manual' },
  { from: 'approved', to: 'awaiting_parts', trigger: 'manual' },
  { from: 'approved', to: 'ready_for_disassembly', trigger: 'manual' },
  // Event-driven: parts satisfied unblocks (Sprint 11 emits the event).
  {
    from: 'awaiting_parts',
    to: 'ready_for_disassembly',
    trigger: 'event_driven',
    eventType: 'parts.requirement.satisfied',
  },
  { from: 'awaiting_approval', to: 'approved', trigger: 'manual' },
  { from: 'awaiting_customer', to: 'approved', trigger: 'manual' },
  { from: 'ready_for_disassembly', to: 'in_disassembly', trigger: 'manual' },
  // Event-driven from segment activity (Sprint 10 driver).
  { from: 'in_disassembly', to: 'in_structural_repair', trigger: 'manual' },
  { from: 'in_disassembly', to: 'in_body_repair', trigger: 'manual' },
  { from: 'in_structural_repair', to: 'in_body_repair', trigger: 'manual' },
  { from: 'in_body_repair', to: 'in_paint_preparation', trigger: 'manual' },
  {
    from: 'in_paint_preparation',
    to: 'in_paint_application',
    trigger: 'manual',
  },
  { from: 'in_paint_application', to: 'in_paint_cure', trigger: 'manual' },
  { from: 'in_paint_cure', to: 'in_assembly', trigger: 'manual' },
  { from: 'in_assembly', to: 'in_calibration', trigger: 'manual' },
  { from: 'in_assembly', to: 'in_quality_control', trigger: 'manual' },
  { from: 'in_calibration', to: 'in_quality_control', trigger: 'manual' },
  { from: 'in_quality_control', to: 'ready_for_delivery', trigger: 'manual' },
  { from: 'in_quality_control', to: 'in_rework', trigger: 'manual' },
  { from: 'in_rework', to: 'in_quality_control', trigger: 'manual' },
  { from: 'ready_for_delivery', to: 'delivered', trigger: 'manual' },
  // Terminal escapes available from any active state (seeded from a few hubs).
  { from: 'approved', to: 'cancelled', trigger: 'manual' },
  { from: 'in_disassembly', to: 'total_loss', trigger: 'manual' },
  { from: 'in_structural_repair', to: 'total_loss', trigger: 'manual' },
];
