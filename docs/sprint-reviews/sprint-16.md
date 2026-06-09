# Sprint 16 Implementation Review — Dashboards & KPI Infrastructure (Single Source of Truth enforced)

**Status:** Complete
**Date:** 2026-06-09
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:** A user signs in and the sidebar **Insights** link auto-routes by role — owners (who can view finance) land on the **Workshop Owner dashboard**, everyone else on the **Production Manager dashboard** (docs/11 §1: the role determines the dashboard, not a menu). The Production Manager sees four rolling-30 KPI tiles (throughput, cycle time, on-time delivery, capacity utilization) above the live Attention / Flow / Pulse picture; the Owner sees health-at-a-glance traffic-light tiles plus the financial position (approved-to-book + export status) and quality (QC failure + rework). Every KPI value is computed by a **registered SSoT calculation** and persisted nightly as a `kpi_snapshot`, so the dashboards and the stored numbers agree by construction.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| Production Manager dashboard | ✅ | `/dashboard/production` — KPI tiles + Attention/Flow/Pulse (reuses the Operations Center zones) |
| Workshop Owner dashboard | ✅ | `/dashboard/owner` — health tiles + finance + quality; `finance:view`-gated |
| `kpi_definitions`, `kpi_snapshots` | ✅ | per-org KPI catalog + append-mostly snapshots (UPSERT per period) |
| Nightly Inngest job | ✅ | `compute-kpi-snapshots` cron `0 2 * * *`; enumerates orgs, recomputes rolling-30 under each tenant context |
| All KPIs use canonical calculation services (SSoT) | ✅ | throughput / cycle time / on-time / utilization are registered metrics; the job and the dashboards both call them |
| Calculation registry enforcement in CI | ✅ | `check:metrics` already gates one-owner-per-calc; 16 metrics now registered |
| Role auto-routing | ✅ | `/dashboard` redirects by permission |
| Painter / Body Technician production-quality dashboards | ⏸ Deferred (D1) | the KPI spine + the two desktop dashboards ship now; the mobile role views are the next dashboard increment |
| Realtime channels, BottleneckDetection (5-min), DeliveryForecast (throttled) | ⏸ Deferred (D2) | the dashboards read the live ops snapshot each load; the dedicated realtime projections + channels are deferred |
| `/dev/dashboards/perf`, `/dev/dashboards/kpi-drift` | ⏸ Deferred (D3) | the SSoT registry makes drift structurally impossible for a single calc; the perf/drift dev surfaces are deferred |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Two new tables (`kpi_definitions`, `kpi_snapshots`) are `organization_id`-scoped with FORCE RLS (migration `0038_dashboards_kpi_rls.sql`). `kpi_snapshots` allows a nullable `workshop_id` (org-wide vs per-workshop); the unique key uses `NULLS NOT DISTINCT` so org-wide re-runs UPSERT rather than duplicate. The nightly job runs each org under its own `runWithContext`, so RLS + audit attribution hold. Tenant isolation suite still green — 19 integration files, 112 tests.

### 2. RBAC compliance — PASS
- The Production Manager dashboard needs a session; the Owner dashboard is `finance:view`-gated and redirects non-owners to the Production Manager view (permissions HIDE the surface, never grey it out — docs/11 §8). KPI definitions are configured under `admin:config`; snapshots are job-written under the org context. **No new permissions — catalog stays frozen at 24** (`check:permissions` green).

### 3. Audit compliance — PASS (tiered correctly)
- KPI snapshots are a computed projection, not a business event — they carry `created_by/updated_by` from the system actor and a `computed_at` timestamp, but are not full-audited (correctly, like other projections). No new domain mutations were added.

### 4. Documentation compliance — PASS
- This review; roadmap Sprint 16 marked delivered; four new metrics registered (`kpi_throughput`, `kpi_cycle_time`, `kpi_on_time_rate`, `kpi_utilization`); `check:metrics` green (16 metrics).

### 5. Production-domain compliance — PASS
- No production aggregate touched. The KPIs are pure read-side projections of delivered cases and booked minutes; they never write back to the production model. Cycle time / throughput / on-time are computed from `cases.opened_at` / `delivered_at`; utilization from work-segment actual minutes vs. headcount capacity.

### 6. Single-Source-of-Truth compliance — PASS (the headline of this sprint)
- Every dashboard number flows through a REGISTERED calculation. `calculateThroughput`, `calculateAverageCycleTime`, `calculateOnTimeDeliveryRate` (production) and `calculateUtilization` (workforce) are pure, unit-tested, and registered; the nightly job persists their output and the dashboards read it — there is no second implementation anywhere. The QC failure + rework tiles on the Owner dashboard reuse the existing `calculateQcFailureRate` / `calculateReworkRate`. This is exactly the "dashboards and snapshots agree by construction" guarantee the sprint goal asked for.

---

## Testing

- **Unit:** 90 passing (13 new: `kpi-metrics.test.ts` — throughput windowing, cycle-time averaging incl. undelivered exclusion, on-time incl. the conservative unpromised case; `utilization.test.ts` — booked/available, overbooking clamp, zero-capacity, negative-floor).
- **Integration:** 112 passing across 19 files (new `dashboard-kpi.test.ts`: the nightly computation writes the four canonical snapshots with correct values, re-running UPSERTs without duplicating, and the time-series read for sparklines — against real Postgres + RLS).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (387 modules, cross-module imports only through `public/`), `check:metrics` ✅ (16), `check:permissions` ✅ (24), `build` ✅ (`/dashboard`, `/dashboard/owner`, `/dashboard/production` present).

---

## Deferred / follow-ups
- **D1 — Painter & Body Technician mobile dashboards** to production quality (the KPI spine + the two desktop dashboards land now).
- **D2 — Realtime channels** (`workshop:<id>:production|yard|notifications`) + `BottleneckDetection` (5-min) + throttled `DeliveryForecast` projections. The dashboards currently recompute the live ops snapshot on each load; the dedicated realtime layer is the next increment.
- **D3 — `/dev/dashboards/perf` + `/dev/dashboards/kpi-drift`** dev surfaces (the SSoT registry already makes single-calc drift structurally impossible; these add load-time + cross-widget monitoring).
- **D4 — Per-workshop snapshots + Executive 12-month sparklines** (the `workshop_id` column + the time-series read are in place; the Executive surface is a later sprint).
- **D5 — Admin widget enable/disable per role + KPI target configuration** (the `kpi_definitions.target_value` column exists; the config UI is deferred).

---

## The eight-hour test
The production manager opens Insights and, in one screen, knows whether the shop is on track this month (four KPI tiles) and what needs her now (Attention/Flow/Pulse) — no spreadsheet, no stale report. The owner sees green/yellow/red health, the money position, and quality, and drills into finance or production in one click. And because every number comes from the same registered calculation that the nightly job stored, two people looking at two dashboards never see two different "cycle times."
