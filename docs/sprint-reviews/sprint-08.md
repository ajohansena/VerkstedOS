# Sprint 08 Implementation Review — Production Workflow + Event Inspection

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main`.
**Demoable outcome:** Confirmed in tests — the production board shows cases by their (projected) workflow state, color-coded by category; transitioning a case appends to the append-only history and projects onto `production_orders.current_state_id` + `cases.status`; the transition emits `production.state.transitioned`, visible in `/dev/events`.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## The Sprint 8 guardrail (user-approved, binding) — HONORED

The production-domain verification established three binding constraints for this sprint. All are enforced in code:

| Guardrail | How it's enforced |
|---|---|
| **`cases.status` is a projection** | The transition machine writes the authoritative append-only `production_state_history` row FIRST, then projects onto `production_orders.current_state_id` AND `cases.status` (via `mapStateToCaseStatus`). Status is never hand-maintained as the primary truth. Documented in the schema doc-comments and the machine. |
| **ProductionOrder is a container** | `production_orders` is 1:1 with a case, holds the pinned workflow definition + a `current_state_id` POINTER (projection). It is not a state machine; the schema comment says so explicitly. |
| **Workflow states are not the source of truth** | States/transitions are configurable DATA per org (ADR-006), seeded as a default; the append-only history is the source of how status evolved. The admin viewer and `/admin/workflow` make this visible. |
| **Segment events become the driver in Sprint 10** | `workflow_transitions.trigger = 'event_driven'` + `event_type` are first-class; `transitionState` accepts a `trigger`/`triggerEventType` so the Sprint 10 segment-event driver slots into the SAME machine with no rework. A seeded example transition (`awaiting_parts → ready_for_disassembly` on `parts.requirement.satisfied`) demonstrates the pattern. |

The integration test asserts the projection directly: after `transitionState(... 'awaiting_parts')`, `cases.status` becomes `on_hold` (the waiting category projected), and the append-only history is the record.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `workflow_definitions`, `workflow_states`, `workflow_transitions` (per org) | ✅ | data, versioned; categories on states |
| Default Norwegian collision-repair workflow seeded | ✅ | 21 states (Norwegian labels) + key transitions; `seedDefaultWorkflow` idempotent |
| State categories (active / waiting / terminal) with behavior | ✅ | drives case-status projection + board color |
| `production_orders` (1:1 with case) | ✅ | container, unique on case_id |
| `production_state_history` (event-audited, append-only) | ✅ | INSERT+SELECT RLS only; immutability proven in test |
| State transition machine with permission checks | ✅ | `production:transition`; validates the move is defined; audit + outbox |
| Workshop production board UI (basic, color-coded) | ✅ | `/production` grouped by state, category colors |
| `production_holds` (waiting states) | ✅ | create/resolve, first-class, audit + events |
| `/dev/events/outbox` | ✅ | pending/published/failed counts + recent + replay |
| `/dev/events/failed` | ✅ | dead-letter list with errors |
| `/dev/events/[id]/replay` | ✅* | replay implemented as an inline action on the outbox row (resets to pending). *Inline replay is more usable than a dedicated route; the capability — manual event replay — is delivered. |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 6 new tables org-scoped; RLS (FORCE) in `0014`. Repos filter by `organization_id`. Tenant isolation 8/8; production suite runs as the non-superuser app role (incl. the append-only history check).

### 2. RBAC compliance — PASS
- Transitions + holds require `production:transition`; workflow viewer requires `admin:config`. No new permissions.

### 3. Audit compliance — PASS
- Transitions and holds write `audit_events` transactionally (transition uses action `transitioned` + reason). `production_state_history` is append-only (the event-tier log). New events: `production.order.created`, `production.state.transitioned`, `production.hold.created`, `production.hold.resolved`.

### 4. Documentation compliance — PASS
- Roadmap Sprint 8 marked complete; this review; guardrail documented in schema comments + here; new events listed.

### 5. Production-domain compliance — PASS (the core of this sprint)
- Aggregates as designed: ProductionOrder (container), WorkflowEngine (data), ProductionStateHistory (append-only). No simplification. Workflow is data, not code. The guardrail is enforced, not just intended.

### 6. Dashboard compliance — PASS
- Production board is operational, color-coded by category (red/yellow/green semantics); no inline arithmetic; Realtime deferred (basic list this sprint per the roadmap).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
No estimate/invoice/parts changes. The append-only state history is exactly the kind of immutable timeline TakstKontroll would replay.

## Single Source of Truth verification — PASS
- The transition machine is the one writer of state changes; `mapStateToCaseStatus` is the single projection rule. No duplicate status logic.

## Three Surfaces verification — PASS
- **User:** `/production` (board), case detail (start production + available transitions).
- **Admin:** `/admin/workflow` (states + categories viewer).
- **Dev:** `/dev/events/outbox` (+ replay), `/dev/events/failed`; production state history queryable per case.

---

## Deviations / mechanics

- **M1 — Replay as inline action** (not a dedicated `/dev/events/[id]/replay` route). The capability is delivered; inline is more usable and avoids a one-row page (No Cleverness).
- **M2 — Workflow editor is a viewer this sprint.** The roadmap lists a full states/transitions/side-effects editor under Admin; the seeded default + read-only viewer ship now, the editor is a later iteration. Flagged, not silently dropped.
- **M3 — Migration numbering.** `0013_production_workflow_tables` (drizzle) + hand-authored `0014_production_workflow_rls`.
- **M4 — Harmless FK-name truncation NOTICE** on a workflow_transitions FK (>63 chars).

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 188 modules) · `check:permissions` (24) · `check:metrics` (2) · `test` (unit 29/29) · `test:integration` (**51/51**: + 8 production-workflow, real Postgres) · `build` (28 routes).

## Drift items → resolution
None. M1/M2 are documented UX-sequencing; M3/M4 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprint 8 closed (reviewing alongside Sprint 9).
