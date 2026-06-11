# Sprint 23 Implementation Review — ST40136 booking-invisibility remediation (Phases A–F)

**Status:** Complete
**Date:** 2026-06-11
**Branch / PR:** committed directly to `main` (incremental commits — Phase A `42a6e4c`, Phase B `3ac6c8b`, Phase C `611adde`, Phase D `3237c4b`, Phase E `6c4d4cf`, Phase F `f75ed91`).
**Demoable outcome:**

1. A receptionist creates a case via the Intake Wizard (`/cases/new`) — the wizard produces a `Case`, its 1:1 `ProductionOrder`, and a `CaseBooking` for the customer's promised arrival in the same transaction (Phase A invariant). The receptionist closes the wizard and immediately opens `/production` in Day View — the new card appears in the **Booked** lane at the booked time slot, without a single segment being scheduled yet. This is the ST40136 fix: a booked case is visible from minute one.
2. The planner opens the same `/production` page and sees the rest of the workshop — cases that already have segments appear in the **In Progress** lane, with the case's active booking attached as context (so the planner still sees the customer-promised arrival/delivery date while looking at segment progress). Switching to Week View shows the same data with per-day lifecycle aggregation. No flicker, no double rows — each case is one card whose lane reflects whether work has started yet.
3. The shop foreman drags the in-progress card to a different resource on Day View — the underlying `ResourceAssignment` is rewritten; the `CaseBooking` is untouched (the customer-promise stays committed; only the internal schedule moved). The audit log records the assignment change with the user's reason; the booking row is unaffected.
4. The workforce admin opens `/admin/employees` and adds "Erik Nilsen — Karosseriteknikker". The form completes and they navigate to `/admin/resources` — Erik already appears as a `kind='person'` Resource because `createEmployee` auto-created the matching Resource in the same transaction (Phase B invariant). They can now be assigned to a `WorkSegment` immediately, without a separate "create resource" step.
5. The same admin opens `/admin/resources` (Phase C admin surface) and creates "Lakkboks 2" as a `kind='equipment'` Resource scoped to the Drammen workshop. The form validates the workshop scope, writes the row through the canonical service path (RLS + audit + outbox), and the new resource appears as a draggable target on the next planner load.
6. A platform engineer runs `pnpm db:seed-demo` against a fresh database (Phase E). In under two minutes the demo is populated with 1 org, 3 workshops, 15 employees + auto-created person resources, 21 canonical workshop facilities/equipment, 50 customers, 75 vehicles, 30 cases distributed across every lifecycle stage, 140 work segments + 259 resource assignments spanning the current week, 12 office tasks covering every kind and priority, 2 suppliers + 2 purchase orders with partial receipts, and 8 bookings (5 pure-booked at the tail + 3 attached as context to in-progress cases). Opening `/production`, `/admin/employees`, `/admin/resources`, `/admin/office-tasks`, and the Parts page on the freshly-seeded demo shows realistic data on every surface — the demo "feels like a workshop that has been actively operating for weeks", not a freshly-initialized database.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Sprint scope rerouting

The original Sprint 23 roadmap entry was "Two-way DBS sync + additional accounting integrations" (docs/09-roadmap.md lines 639+). On 2026-06-11 the project owner reported **ST40136**: freshly-booked cases were invisible on the Production Board because the planner read model only listed `WorkSegment`-anchored rows, so a `CaseBooking` without a matching segment had no row to project. The owner approved a 7-phase remediation plan (Phase A–F plus this sprint review) covering: the production-order invariant, the person-resource invariant, the missing `/admin/resources` admin surface, the unified planner read model, a comprehensive demo seed, and the documentation that should have prevented the bug. Sprint 23 was rerouted to that work; DBS bidirectional sync + PowerOffice/Visma integrations carry forward to a future sprint.

---

## Deliverables: shipped

| Deliverable | Status | Notes |
|---|---|---|
| **Phase A — intrinsic `ProductionOrder`** | ✅ | `createCaseInTx` now creates the matching `ProductionOrder` in the same transaction (`ensureProductionOrderForCaseInTx`). Backfill migration covered any existing Cases lacking an order. Removed the prior "promote case to production" deferred path; a `Case` without a `ProductionOrder` is now an inconsistent state. |
| **Phase B — auto-create person `Resource`** | ✅ | `createEmployeeInTx` calls `ensurePersonResourceForEmployeeInTx` in the same transaction; the resulting `kind='person'` Resource is immediately assignable. Backfill migration covered existing Employees missing a person Resource. |
| **Phase C — `/admin/resources` CRUD admin surface** | ✅ | New admin page + row actions, gated by `admin:config`. Form supports `kind` (person / equipment / facility), `status` (active / inactive / maintenance), `workshopId` scoping, and goes through the canonical workforce service path (RLS + audit + outbox), not a bypass. |
| **Phase D — unified `PlannerRow` read model + Booked lane** | ✅ | `src/modules/production/application/queries/list-planner-rows.ts` projects two sources into one shape: `lifecycle='booked'` rows from active `CaseBooking` rows that have no active `WorkSegment` for the case yet; `lifecycle='in_progress'` rows from `WorkSegment` + `ResourceAssignment`, with the active booking attached as context if present. One card per case across the full lifecycle; the lane transition is a pure consequence of the underlying data. Day View + Week View both render the new model. Sub-barrel `src/modules/production/public/transitions.ts` introduced to break a structural cycle between case→production. 5 integration tests in `tests/integration/planner-rows.test.ts`. |
| **Phase E — comprehensive demo seed** | ✅ | `scripts/seed-demo.ts` rewritten to populate every major subsystem end-to-end (full row counts in the validation section below). All sections idempotent by deterministic natural keys. Drift fixed: employees no longer bypass the workforce module (the previous seed inserted memberships directly, which would have produced the same kind of "exists but invisible to operators" failure mode ST40136 exhibited at the planner). |
| **Phase F — doc 13 § 20.4 + ADR-0011 + CLAUDE.md § 4.4** | ✅ | Doc 13 § 20.4 rewritten to retire "bookings are normal ResourceAssignment rows" and bind the planner to the continuous-lifecycle invariant. ADR-0011 records that `CaseBooking` and `ResourceAssignment` are permanently distinct entities, enumerates the four cascading problems caused by the original conflation, and documents the unified read model. CLAUDE.md § 4.4 adds the intrinsic-aggregate invariants for `ProductionOrder`-per-Case and person-`Resource`-per-Employee, lists `CaseBooking` as a protected aggregate, and adds "Combine `CaseBooking` and `ResourceAssignment`" to the may-not list. |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- No new tables shipped. Phase A/B/C/D worked entirely on top of existing tables (`cases`, `production_orders`, `employees`, `resources`, `work_segments`, `resource_assignments`, `case_bookings`) — all already have `organization_id NOT NULL` with FORCE RLS, verified by the existing tenant-isolation suite.
- The new `listPlannerRowsForRange` query goes through the tenant-aware client (`withTransaction(ctx, ...)`) — same path as every other planner read. The two underlying lookups (`listPlannedSegmentsForRange`, `listActiveBookingsForOrgInRange`) both inherit `app.current_org_id` from the surrounding transaction.
- The `/admin/resources` page reuses the existing `resource:list` / `resource:create` / `resource:update` repository paths — no new RLS surface to introduce.
- The Phase E seed runs as the superuser (RLS-bypassing) for org-bootstrap operations as documented in the script header; every per-org operation (`createEmployee`, `createResource`, `createBooking`, etc.) goes through `withTransaction(ctx, ...)` with the right org context. The validator run confirmed end-to-end isolation: a single org's data was created without leaking the system user's identity into tenant-scoped audit columns (the audit trail correctly tagged each row with the seeded owner user, not the superuser).

### 2. RBAC compliance — PASS
- **Permission catalog unchanged — 24 permissions** (`check:permissions` green). Sprint 23 added no permissions; all phases reuse existing gates:
  - `case:edit` — Phase A intake-driven Case + ProductionOrder creation
  - `workforce:manage` — Phase B `createEmployee` (which now also creates the person Resource)
  - `admin:config` — Phase C `/admin/resources` CRUD; Phase E seed orchestration
  - `case:book` — Phase D booked-lane rows (the customer-facing commitment)
  - `production:plan` — Phase D in-progress-lane rows (the internal resource schedule)
- The permission split between `case:book` and `production:plan` (formalized by ADR-0011) is now reflected in doc 13 § 20.4: a receptionist with `case:book` can commit the customer-facing booking, but committing `ResourceAssignment` rows still requires `production:plan` — no permission was over-granted to fix the bug.
- No bypass introduced. The Phase E seed's superuser connection is the same long-documented bootstrap path used since Sprint 01; it is not a new bypass.

### 3. Audit compliance — PASS
- Every mutation in Phase A/B/C goes through the canonical service path (`createCase`, `createEmployee`, `createResource`) which writes a tenant `audit_events` row in the same transaction. The intrinsic-aggregate work (Phase A's `ensureProductionOrderForCaseInTx`, Phase B's `ensurePersonResourceForEmployeeInTx`) is also audited — both produce a `created` audit row tagged with `generatedBy='intrinsic'` provenance so an operator scanning the audit log can see the same-tx auto-creation distinctly from a separately-authored row.
- Phase D introduces no mutations — it is a read-only composer over existing tables.
- Phase E seed writes a `created` audit row per entity through the standard service path (Cases, Employees, Resources, Customers, Vehicles, OfficeTasks, PartRequirements, PurchaseOrders, Bookings) — the demo audit trail is realistic, not stripped.
- No audit table was modified. No UPDATE/DELETE path opened on append-only tables. No outbox writes outside a mutation tx.

### 4. Documentation compliance — PASS
- This review.
- Doc 13 § 20.4 rewritten (Phase F commit `f75ed91`).
- ADR-0011 created (`docs/adrs/0011-case-booking-vs-resource-assignment.md`).
- CLAUDE.md § 4.4 hardened with three intrinsic-aggregate invariants and the no-merge rule for `CaseBooking`/`ResourceAssignment`.
- The 09-roadmap entry for Sprint 23 still reads as the originally-planned scope (DBS sync + accounting integrations); the rerouting note above documents the swap. A follow-up roadmap touch-up moving DBS/accounting forward and reflecting Sprint 23's actual ST40136 scope is recommended before Sprint 24 planning.

### 5. Production-domain compliance — PASS
- All seven protected aggregates remain as designed. `ProductionOrder` and the person-`Resource` invariants are now **strengthened**, not weakened — both are intrinsic to their owning aggregate (Case / Employee) and created in the same transaction.
- `CaseBooking` is now an explicitly protected aggregate (CLAUDE.md § 4.4 + ADR-0011); the prior conflation with `ResourceAssignment` is retired.
- No "simplifications" merged the aggregates. The fix for ST40136 was a read-model composition, not a schema merge — exactly the move the production-domain rules demand.
- Workflow remains data, not code. The continuous-lifecycle invariant is enforced in the read model (`listPlannerRowsForRange`) on top of the existing aggregates; no new state machine, no new enum.
- Multi-location case flow preserved — `CaseTransfer` is untouched. A transferred case carries its `ProductionOrder` and (via the read model) its active `CaseBooking` to the new workshop's planner.
- Funding sources untouched.

### 6. Dashboard / UX compliance — PASS
- The Production Board (Day View + Week View) follows the role-specific design in doc 11. Touch targets remain ≥ 56 px; the new Booked lane uses the same column geometry as the In Progress lane so drag/drop interactions are unchanged.
- No generic ERP dashboards introduced.
- The unified read model goes through the metric registry / SSoT discipline — the planner page consumes `listPlannerRowsForRange` directly; no inline aggregation in the React tree.
- Realtime channels unchanged.
- The `/admin/resources` page (Phase C) is the new admin surface; it follows the existing `/admin/employees` layout for consistency and uses canonical Norwegian labels via `getDictionary()`.

---

## Testing

- **Unit:** 139 passing (no change vs Sprint 22 baseline — Sprint 23 added no unit-tested calculations).
- **Integration:** +5 new in `tests/integration/planner-rows.test.ts`:
  - booked-only case appears in `lifecycle='booked'` lane
  - in-progress case (segments + assignments) appears in `lifecycle='in_progress'` lane
  - in-progress case with active booking attaches the booking as context (no separate row)
  - range filtering: a booking outside the requested range is excluded
  - multi-tenant isolation: org B cannot see org A's planner rows
  Total integration suite **184 / 184 passing** in 386–405 s (two independent runs this session confirm).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (538 modules / 2750 deps), `format:check` ✅, `check:metrics` ✅ (20), `check:permissions` ✅ (24), unit ✅ (139/139), integration ✅ (184/184).
- **End-to-end seed validation:** `scripts/seed-demo.ts` ran against a fresh testcontainer Postgres and produced — verified by direct row counts via the admin (RLS-bypassed) connection — 1 org, 3 workshops, 16 users, 15 employees, 18 employee skills, 36 resources (15 person + 15 equipment + 6 facility), 50 customers, 75 vehicles, 30 cases, 140 work segments, 259 resource assignments, 12 office tasks, 18 part requirements, 2 purchase orders, 11 received PO lines, 8 bookings. All planner lanes populated; no surface (planner, employees, resources, office tasks, parts) is empty on a fresh install.

---

## Drift items found and their resolution

While implementing Phase E, the architectural review the project owner mandated for this sprint ("continue reviewing the architecture documents against the implementation … if you discover additional places where the implementation has drifted from the architecture, please stop and report them before implementing ad-hoc fixes") surfaced two drifts in the prior `scripts/seed-demo.ts`:

1. **Employees bypassed the workforce module.** The prior seed inserted `memberships` rows directly without calling `createEmployee`, so the canonical workforce code path (which auto-creates the person Resource in the same tx per Phase B) never ran. A fresh install showed zero rows on `/admin/employees` and `/admin/resources` — the same "exists but invisible" failure mode ST40136 exhibited at the planner.
   **Resolution:** Phase E rewrote the employees loop to call `createEmployee` after `addMembershipWithRole`. The Phase B auto-create-person-Resource invariant now fires for every demo employee. The validator confirmed 15 employees → 15 person Resources end-to-end. Reported to and approved by the project owner before implementation.

2. **No planner data on a fresh install.** The prior seed created Cases but no `WorkSegment` / `ResourceAssignment` / `CaseBooking` rows, so the planner was empty even with 25 cases present. A first-time demo viewer could not evaluate the planner feature without manually scheduling work.
   **Resolution:** Phase E added four end-to-end sections (work segments + assignments, office tasks, parts flow, bookings) that populate realistic distributed work across this week (Mon → next Mon). Reported to and approved by the project owner; the owner also expanded the scope to "every major subsystem should contain enough realistic data that I can evaluate the feature immediately without first creating or editing records manually" — Phase E was sized to that brief.

No further drift was found during Phase D or Phase F implementation. The ADR-0011 + doc 13 § 20.4 + CLAUDE.md § 4.4 edits in Phase F codify the principles surfaced by ST40136 itself so future contributors cannot recreate the same conflation.

---

## TakstKontroll compatibility check (CLAUDE.md § 4.7) — PASS
- No change to case-cost aggregation. `CaseBooking` rows are not summed into the billable basis; `ResourceAssignment` rows continue to feed only the capacity-engine and the (already-TakstKontroll-safe) work-segment-cost calculations.
- The intrinsic-`ProductionOrder` invariant (Phase A) is TakstKontroll-positive — every Case now has a queryable `ProductionOrder` foreign key, which is what a future TakstKontroll integration would join against to reconcile a workshop's repair scope with an insurer's authorization.
- The intrinsic-person-`Resource` invariant (Phase B) is TakstKontroll-neutral — Resources are not part of the case-cost projection.

---

## Three Surfaces verification — PASS
- **User (planner) surface:** Day View and Week View now render both lanes (Booked + In Progress) for every booked or in-progress case. The Booked lane is the new operator-visible surface that ST40136 was missing.
- **Admin surface:** `/admin/resources` (Phase C) is the new CRUD surface for non-person resources. `/admin/employees` continues to be the surface for hiring (now with intrinsic person-Resource creation per Phase B).
- **Dev surface:** No new Dev Control Plane page was required for Sprint 23 (the bug was a read-model gap, not an operational tool gap). The existing `/dev/cases` and `/dev/production` inspectors continue to surface the same data; the unified `listPlannerRowsForRange` query would be a natural reuse for a future "cross-org planner inspector" if/when a platform engineer needs one.

---

## Single Source of Truth verification — PASS
- One read function for the planner: `listPlannerRowsForRange` (Phase D, sub-barrel `src/modules/production/public/index.ts`). Day View, Week View, and any future Resource View must consume this function — there is no second path to the same data.
- One intrinsic-aggregate helper per invariant: `ensureProductionOrderForCaseInTx` (Phase A), `ensurePersonResourceForEmployeeInTx` (Phase B). Both are sub-barrel-exported (`src/modules/production/public/transitions.ts`, `src/modules/workforce/public/index.ts`) so the calling services do not duplicate the logic.
- Metric registry unchanged (20). No new dashboard KPI; no new SSoT entry needed.
- The Phase E seed exercises the same service paths as production for every entity it creates — by design, the demo cannot diverge from how operators actually use the platform.

---

## Final gate footer

`typecheck / lint / format / depcruise (538 modules / 2750 deps) GREEN; metric registry 20; permission catalog 24; unit 139/139; integration 184/184. Demo seed verified end-to-end against a fresh testcontainer Postgres.`
