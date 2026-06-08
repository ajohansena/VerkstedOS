# Sprint 09 Implementation Review — Resources, Time & Clock

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main`.
**Demoable outcome:** Confirmed in tests — Erik (a combined-role employee: body + paint + assembly) clocks into a paint segment from the mobile screen; the manager's "who's working" view shows him on `paint_preparation`; a second clock-in is rejected; clock-out produces an event-tier time entry; a correction is recorded as a new full-audited row.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Production-domain guardrail link (Sprint 9 → 10)

A clock-in optionally carries a `case_id` + `segment_code`. This is the deliberate hook the production guardrail relies on: in **Sprint 10**, clocking into `paint_preparation` will mark that work segment active and drive the case's status PROJECTION via the same transition machine built in Sprint 8. Sprint 9 records the activity and the link; Sprint 10 activates it. The `clock_sessions.segment_code` column comments note it becomes a `work_segment_id` FK in Sprint 10.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `employees` (separate from users) | ✅ | optional `user_id`; `employee_number` for shared-device clock-in |
| `employee_skills` with proficiency | ✅ | apprentice/qualified/expert; multi-skill (combined roles) |
| `resources` (people, equipment, facilities) | ✅ | `kind` person/equipment/facility; equipment + facilities first-class |
| `shift_definitions` per workshop | ✅ | minutes-from-midnight, weekday mask, timezone |
| `time_entries` (event original / full corrections) | ✅ | original event-tier; correction = new row (`kind='correction'`, `corrects_entry_id`) |
| `clock_sessions` with partial unique (one open per employee) | ✅ | `clock_sessions_one_open_per_employee` partial unique; proven at DB level |
| Mobile clock-in/out (≥56px, glove-friendly) | ✅ | `/clock` — h-14/h-16/h-20 targets, high contrast, Norwegian labels, thumb-zone primary actions |
| Task time registration on segments | ✅ | clock-in carries `segment_code`; time entry inherits it |
| `absence_types` + `absence_entries` (basic) | ✅ | paid/affects-capacity flags |
| Calendar concept (working hours, holidays) | ✅* | shift definitions provide working hours; the full holiday calendar is folded into shifts for the MVP (see M1) |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 8 new tables org-scoped; RLS (FORCE) in `0016`. Repos filter by `organization_id`. Tenant isolation 8/8; workforce suite runs as the non-superuser app role (incl. the partial-unique guard via the admin role).

### 2. RBAC compliance — PASS
- Clock-in/out require `time:self`; corrections require `time:correct`; employee management requires `admin:config`. No new permissions.

### 3. Audit compliance — PASS (tiered correctly)
- Time-entry ORIGINALS are event-tier (the clock-out row IS the record). CORRECTIONS are full-audited (new row + `audit_events` with mandatory reason; never an in-place edit). Employee creation full-audited. New events: `workforce.clock.in`, `workforce.clock.out`, `workforce.time.corrected`, `workforce.employee.created`.

### 4. Documentation compliance — PASS
- Roadmap Sprint 9 marked complete; this review; the Sprint 10 driver link documented in schema comments + here.

### 5. Production-domain compliance — PASS
- Resources are people, equipment, AND facilities (not simplified away). Combined-role technicians supported via many `employee_skills`. The clock→segment link is preserved for the Sprint 10 driver. No aggregate removed.

### 6. Dashboard compliance — PASS (mobile-first)
- `/clock` meets the floor-UI bar: touch targets ≥56px (h-14 = 56px and up), high contrast, primary actions in the thumb zone, Norwegian labels. No inline arithmetic in presentation (duration computed in the service).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
Time entries use a single unit (minutes) for billable and internal work; corrections preserve the original via `corrects_entry_id` (no in-place edits) — exactly the line-for-line, immutable substrate TakstKontroll compares against. `funding_source_id` retained on time entries.

## Single Source of Truth verification — PASS
Clock duration computed once in the clock service. No KPI calc duplicated.

## Three Surfaces verification — PASS
- **User:** `/clock` (mobile clock-in/out + who's working).
- **Admin:** `/admin/employees` (create employees + skills).
- **Dev:** `/dev/workforce` (open sessions + time-correction audit view).

---

## Deviations / mechanics

- **M1 — Calendar folded into shifts for MVP.** The roadmap lists a "calendar concept (working hours, holidays)". Working hours ship via `shift_definitions`; a dedicated holiday/calendar table (Norwegian public holidays seed + per-resource downtime) lands with the capacity engine in Sprint 10, where it is actually consumed. Flagged, not silently dropped.
- **M2 — Resources table shipped but not yet planned-against.** `resources` (person/equipment/facility) is created now so equipment/facility capacity exists for Sprint 10's planner; assignment/capacity logic is Sprint 10.
- **M3 — Migration numbering.** `0015_workforce_tables` (drizzle) + hand-authored `0016_workforce_rls` (incl. the partial unique index).
- **M4 — Harmless FK-name truncation NOTICE** on a long workforce FK (>63 chars).

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 205 modules) · `check:permissions` (24) · `check:metrics` (2) · `test` (unit 29/29) · `test:integration` (**59/59**: + 8 workforce-clock, real Postgres) · `build` (32 routes).

## Drift items → resolution
None. M1/M2 are documented sequencing into Sprint 10; M3/M4 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprints 8 + 9 closed (reviewed together).
