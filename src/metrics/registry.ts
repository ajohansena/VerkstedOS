/**
 * Single Source of Truth — metric registry (CLAUDE.md § 4.5).
 *
 * Maps each metric name to the module + calculation function that owns it.
 * Dashboards, reports, APIs, server actions, and the Dev Control Plane all call
 * the same calculation. There is exactly one authoritative owner per metric.
 *
 * Empty until calculations arrive (e.g. workforce productivity in Sprint 9+).
 * `pnpm check:metrics` enforces one-owner-per-calculation.
 */

export interface MetricEntry {
  /** Owning bounded context, e.g. 'workforce'. */
  readonly module: string;
  /** Pure calculation function name, e.g. 'calculateSoldHours'. */
  readonly calc: string;
}

export const metricRegistry = {
  estimate_labor_hours: { module: 'estimating', calc: 'sumEstimateLabor' },
  periods_to_hours: { module: 'estimating', calc: 'periodsToHours' },
  resource_capacity: { module: 'production', calc: 'computeCapacity' },
  remaining_work_minutes: {
    module: 'production',
    calc: 'remainingWorkMinutes',
  },
  case_acceptance_feasibility: {
    module: 'production',
    calc: 'classifyFeasibility',
  },
  part_reconciliation: {
    module: 'parts',
    calc: 'reconcilePartRequirement',
  },
  qc_failure_rate: {
    module: 'quality',
    calc: 'calculateQcFailureRate',
  },
  rework_rate: {
    module: 'quality',
    calc: 'calculateReworkRate',
  },
  case_risk: {
    module: 'operations',
    calc: 'classifyCaseRisk',
  },
  supplier_invoice_match: {
    module: 'parts',
    calc: 'calculateInvoiceMatch',
  },
  invoice_line_vat: {
    module: 'finance',
    calc: 'calculateLineVat',
  },
  invoice_basis_total: {
    module: 'finance',
    calc: 'calculateInvoiceBasisTotals',
  },
  kpi_throughput: {
    module: 'production',
    calc: 'calculateThroughput',
  },
  kpi_cycle_time: {
    module: 'production',
    calc: 'calculateAverageCycleTime',
  },
  kpi_on_time_rate: {
    module: 'production',
    calc: 'calculateOnTimeDeliveryRate',
  },
  kpi_utilization: {
    module: 'workforce',
    calc: 'calculateUtilization',
  },
  absence_minutes_in_day: {
    module: 'production',
    calc: 'absenceMinutesInDay',
  },
  yard_occupancy: {
    module: 'yard',
    calc: 'summarizeOccupancy',
  },
  booking_date_validation: {
    module: 'case',
    calc: 'validateBookingDates',
  },
  open_office_tasks_for_case: {
    module: 'workforce',
    calc: 'calculateOpenOfficeTaskSummary',
  },
} as const satisfies Record<string, MetricEntry>;

export type MetricName = keyof typeof metricRegistry;
