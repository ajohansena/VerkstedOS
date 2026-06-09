/**
 * Dashboards & KPIs — public surface (Sprint 16).
 *
 * The ONLY entry point other modules and the app may import from. Owns the KPI
 * snapshot tables and the nightly computation; every value flows through a
 * REGISTERED calculation (production KPIs + workforce utilization), so the
 * dashboards and the stored snapshots agree by construction (SSoT).
 */

export type { KpiDefinition, KpiSnapshot } from '@/db/types';

// Snapshot computation (nightly job + Dev on-demand)
export {
  computeRolling30Snapshots,
  type SnapshotResult,
} from '../application/services/kpi-snapshot';

// Reads
export {
  listLatestSnapshots,
  listLatestSnapshotsByWorkshop,
  listSnapshotSeries,
  listKpiDefinitions,
  type DeliveredCaseRow,
} from '../infrastructure/repositories/kpi-repository';
