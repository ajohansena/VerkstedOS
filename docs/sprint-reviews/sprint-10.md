# Sprint 10 Implementation Review — Work Segments & Planning

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main`.
**Demoable outcome:** Confirmed in tests — a paint segment is created on a case from the catalog (planning unit, status `not_started`); Erik clocks into that `work_segment` and it moves to `in_progress` with `actual_start_at` stamped (`production.segment.started` emitted); on clock-out + complete, `actual_minutes` is recomputed from the segment's tagged time entries and `production.segment.completed` is emitted; assigning the same resource to an overlapping window surfaces `RESOURCE_CONFLICT` rather than overwriting, and an explicit override records who overrode it.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## The guardrail activation (Sprint 8 → 9 → 10)

This is the sprint the production-domain guardrail was built toward.

- **Sprint 8** made `cases.status` a *projection* of an append-only transition log (workflow = data).
- **Sprint 9** had clock-in carry a `case_id` + `segment_code` — the deliberate hook.
- **Sprint 10** activates it: a technician **clocking into a work segment** is now the PRIMARY driver of production progress. `clockIn` accepts `workSegmentId`, stores it on the session, and calls `markSegmentActive`, which moves the segment to `in_progress`. Completing a segment recomputes `actual_minutes` from `time_entries.work_segment_id` and emits `production.segment.completed` — the event that advances the case status projection through the same Sprint-8 transition machine.

Status is **derived from real work activity**, never hand-maintained. No status string is set by a human as the source of truth.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `work_segments` (required_skills, required_equipment_kinds, planned_minutes) | ✅ | THE planning unit; sequence per case; `default_funding_source_id` |
| Work-segment catalog (~23 codes) | ✅ | `WORK_SEGMENT_CATALOG` — Norwegian labels, skills, equipment kinds |
| `tasks` (optional finer decomposition) | ✅ | table + RLS shipped |
| `work_segment_dependencies` (prerequisite chains) | ✅ | unique (segment, prerequisite); `must_complete_before` / `must_start_before` / `soft_preferred` |
| `resource_assignments` (planned + actual) | ✅ | role primary/assist/observer; conflict tracking columns |
| `resource_capacity` calculation engine | ✅ | `computeCapacity` (SSoT); pure functions, 8 unit tests |
| `capacity_forecast_snapshots` (forward projection) | ✅ | table + RLS shipped (per-resource/day total/committed/available) |
| Conflict detection on assignment | ✅ | overlap on same resource → `RESOURCE_CONFLICT`; `allowConflict` override recorded |
| Capacity view per resource | ✅ | `computeCapacity` + reads; consumed by simulate-accept classification |
| Work segments tagged with `default_funding_source_id` | ✅ | column + service param |
| "Simulate accepting this new case" | ✅ | `classifyFeasibility(load, additionalMinutes)` → comfortable/tight/overbooked (SSoT metric) |
| Drag-and-drop planning calendar (desktop) | ⏸ Deferred (D1) | capacity engine + reads ship now; the DnD calendar visualization is deferred to a UI-polish sprint |
| Capacity heatmap | ⏸ Deferred (D1) | same — the underlying calculation is live; the heatmap rendering is deferred |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 5 new tables (`work_segments`, `tasks`, `work_segment_dependencies`, `resource_assignments`, `capacity_forecast_snapshots`) carry `organization_id NOT NULL`; RLS ENABLE + FORCE with org-scoping policies in `0018`. All services go through `withTransaction` (txn-scoped session vars); Dev reads use the platform-inspector connection. Tenant isolation 8/8 green under the non-superuser app role.

### 2. RBAC compliance — PASS
- `addWorkSegment` and `assignResource` require `production:plan`; `completeSegment` requires `production:transition` (it is production progress, same as a state move). No new permissions — catalog stays at **24**. Dev recompute is behind the hardened `/dev` guard (platform-only).

### 3. Audit compliance — PASS (tiered correctly)
- Segment creation and completion are full-audited via `recordAuditEvent` (completion carries a `reason`). Resource assignment is audited (records the conflict-override flag). New events via the transactional outbox: `production.segment.created`, `production.segment.started`, `production.segment.completed`, `production.segment.assigned`. No in-place edits to time data — the clock-out time entry is stamped with `work_segment_id` and is the immutable substrate `actual_minutes` derives from.

### 4. Documentation compliance — PASS
- Roadmap Sprint 10 marked complete with the guardrail-activation note and D1 deferral recorded; this review; 3 new metrics registered in `src/metrics/registry.ts` (`resource_capacity`, `remaining_work_minutes`, `case_acceptance_feasibility`).

### 5. Production-domain compliance — PASS
- All aggregates preserved and NOT simplified: `ProductionOrder` (container), `WorkSegment` (the planning unit — NOT collapsed into tasks/tickets), `Capacity` (a calculation from resources + load, never a stored flat number), `Resource` (person/equipment/facility), `ResourceAssignment` (explicit; conflicts surfaced, never silently overwritten), `WorkflowEngine` (data). Workflow stays data. Multi-funding preserved (`default_funding_source_id` on segments). Status remains a projection — now driven by segment/clock activity.

### 6. Dashboard compliance — PASS
- Case-detail "Work segments" card (User surface) shows planned/remaining hours and segment status; no inline arithmetic on money/percentages in presentation (hour rounding only for display; all capacity math is in the SSoT calculation). KPIs use the registry. Realtime not introduced here (read fanout remains a later concern).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- `actual_minutes` is **derived** from immutable, segment-tagged time entries (single unit: minutes, billable and internal alike) — exactly the line-for-line substrate TakstKontroll replays. `default_funding_source_id` retained on every segment so billable work stays funding-traceable. No estimate/invoice/parts data made mutable or aggregated in a way that loses case-level traceability. The Dev recompute repair re-derives via the SAME canonical path, never via ad-hoc SQL that could diverge from the production rule.

## Single Source of Truth verification — PASS
- Capacity, remaining work, and acceptance feasibility are computed once in `src/modules/production/application/calculations/capacity.ts` and registered. The Dev recompute tool and `completeSegment` share the identical `actual_minutes` derivation (sum of `time_entries.duration_minutes` where `work_segment_id` matches). No duplicated calculation.

## Three Surfaces verification — PASS
- **User:** case-detail work-segment planning — add segments from the catalog, see status driven by clock activity, complete a segment.
- **Admin:** planning policy via `allowConflict` on assignment (overbooking allowed with an audited override vs strict reject) — the overbooking-allowed/strict policy from the roadmap.
- **Dev:** `/dev/production` — cross-org work-segment inspection (planned vs actual) + `actual_minutes` recompute repair.

---

## Deviations / mechanics

- **D1 — DnD calendar + heatmap deferred.** The roadmap lists a drag-and-drop planning calendar and capacity heatmap. The *capacity engine, conflict detection, simulate-accept, and reads* all ship now (the data-first layer per CLAUDE.md § 4.9). The DnD calendar and heatmap are presentation polish; they are deferred to a dedicated UI sprint rather than shipped thin. Flagged, not silently dropped.
- **M1 — Schema link columns.** `clock_sessions.work_segment_id` and `time_entries.work_segment_id` added (FK `set null` / plain uuid respectively) to carry the clock→segment driver link. Both added in `0017`.
- **M2 — Migration numbering.** `0017_work_segments_planning` (drizzle: 5 tables + the two `work_segment_id` ALTERs) + hand-authored `0018_work_segments_rls`.
- **M3 — `assignResource` cross-context legality.** `clock.ts` (workforce) imports `markSegmentActive` from `@/modules/production/public` — an application-layer call through a public port; production never imports the workforce module. `depcruise` clean.
- **M4 — Harmless FK-name truncation NOTICE** on `work_segments_default_funding_source_id_case_funding_sources_id_fk` (>63 chars). Cosmetic; Postgres truncates the identifier.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 219 modules) · `check:permissions` (24) · `check:metrics` (5) · `test` (unit 37/37) · `test:integration` (**64/64**: + 5 work-segments-planning, real Postgres) · `build`.

## Drift items → resolution
None. D1 is a documented presentation-polish deferral (the data + calculation layer is complete); M1–M4 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprints 10 + 11 closed (reviewed together).
