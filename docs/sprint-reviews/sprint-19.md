# Sprint 19 Implementation Review — Yard management + Production Board v3 Week View

**Status:** Complete
**Date:** 2026-06-23
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:**

1. An admin opens **/admin/yard** and builds the workshop's first yard: a single layout `Y1 · Hovedtomt`, three bays (`B1`, `B2`, `B3`), four parking slots (`P1`–`P4`, each tagged with a QR code), and one storage spot (`S1`, capacity 4). Within seconds the **/yard/map** view shows the whole tomt as a colour-coded grid — every slot green for "Ledig".
2. A coordinator opens **/yard/map** on a tablet, taps **Flytt kjøretøy**, picks an arriving case + slot `P1`, reason "Ankomst" — the slot turns amber for "Opptatt". A second case can't be placed in the same single-cap parking spot: the form returns `YARD_LOCATION_FULL` and the slot stays as it was.
3. A body tech with a phone walks to bay `B1`, scans the printed QR sticker through **/yard/map** → **Skann QR**, and the active case for that bay updates in one round-trip. The append-only **vehicle_movements** ledger now has three rows — `into_bay`, then `out_of_bay` an hour later when the painter walks the car to `B2`, then `into_storage` when the vehicle moves out to `S1` after paint cures.
4. The Production Board v3 ships its **fourth visualization**: **Uke**. Same engine as Dag and Ressurser, different lens — a resource × 5-weekday grid with each cell showing the day's top case and a utilization bar; the bottom **Avdelingslast** row aggregates the week's planned vs available capacity per day so a planner can answer "kan vi ta inn én lakkjobb til denne uka?" in one glance.
5. The platform inspector opens **/dev/yard** and sees layouts, locations, active placements, and the movement ledger across every org — the same Dev Control Plane discipline the rest of the platform follows.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| `yard_layouts` + `yard_locations` (admin-configurable physical map) | ✅ | migration `0043_yard_tables.sql` + RLS `0044_yard_rls.sql`; unique (org, code) + (layout, code) + (org, qr_tag) |
| `vehicle_placements` (one active row per case) | ✅ | `caseId` UNIQUE constraint — at most one active placement per case; `onConflictDoUpdate` upserts on move |
| `vehicle_movements` (append-only ledger) | ✅ | no lifecycle columns; INSERT + SELECT RLS only; `movedAt`, `reason` enum, optional `fromLocationId` (set null on delete-protect), restrict on `toLocationId` |
| Three new enums (`yard_location_status`, `yard_location_kind`, `vehicle_movement_reason`) | ✅ | appended to `src/db/enums.ts` |
| Move-vehicle SSoT (`moveVehicleToLocation`) | ✅ | one transaction: upsert placement → append movement → recompute status on source + destination via `deriveLocationStatus` |
| QR-scan flow (`moveVehicleByQrTag`) | ✅ | resolves QR → calls SSoT mover; unknown QR throws `YARD_QR_NOT_FOUND` |
| Occupancy SSoT (`summarizeOccupancy` + `deriveLocationStatus`) | ✅ | `src/modules/yard/application/calculations/occupancy.ts`; metric registered as `yard_occupancy` (18 total) |
| Capacity + blocked-slot enforcement | ✅ | `YardLocationFullError` and `YardLocationBlockedError` raised by the service; integration tests cover both |
| Production Board v3 — Week View (doc 13 § 4.3) | ✅ | resource × 5-weekday grid, top-case label per cell, utilization bar per cell, DEPT LOAD row aggregating planned vs available |
| Three Surfaces (User / Admin / Dev) | ✅ | user `/yard/map` (mobile-first map + move/scan forms, ≥44 px targets); admin `/admin/yard` (layout designer + location form per layout); dev `/dev/yard` (cross-org layouts, locations, placements, movements) |
| Existing UI touched by sprint | ✅ | `/yard` (Sprint 13 transfers view) gains an inline link to `/yard/map`; admin index gains `Tomte-designer` link gated on `canConfig` |
| Per-org absence-type configuration UI (D3 from Sprint 18) | ⏸ Deferred (D1) | yard sprint already crowded `/admin`; absence-type CRUD lands in Sprint 20 alongside org-settings polish |
| Cryptographic chained signature on rental agreements (D1 from Sprint 18) | ⏸ Deferred (D2) | unchanged from Sprint 18; lands with customer portal v2 in Sprint 20 |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All four new yard tables carry `organization_id NOT NULL` with FORCE RLS and an `org_isolation` policy (migration `0044_yard_rls.sql`). `vehicle_movements` is the only append-only table — its policy stack is INSERT + SELECT only (no UPDATE, no DELETE), so the ledger can never be rewritten by application code. Every service call goes through `withTransaction(ctx, …)` so RLS sees `app.current_org_id`. The platform inspector page goes through `getRawClient({as: 'platform-inspector'})`. The RLS migration contains no GRANT statements — the harness creates `app_user` AFTER applying migrations and grants table privileges globally (lesson recorded after Sprint 18). Tenant-isolation suite green.

### 2. RBAC compliance — PASS
- `createYardLayout`, `createYardLocation` → `admin:config` (only admins shape the physical map). `moveVehicleToLocation`, `moveVehicleByQrTag` → `case:edit` (coordinators / techs move cars). **No new permissions — catalog stays frozen at 24** (`check:permissions` green). Admin index hides the new link behind `canConfig`; dev inspector is gated by the `/dev` layout; the user-facing `/yard/map` requires a session but otherwise reuses the same authorization the rest of `(app)` enforces.

### 3. Audit compliance — PASS (tiered correctly)
- Every yard mutation calls `recordAuditEvent` (past-tense actions: `created` for layouts and locations, `updated` for placements). Every move also emits an outbox event `yard.vehicle.moved` carrying `{caseId, fromLocationId, toLocationId, reason}`. The `vehicle_movements` table is itself the append-only audit trail for placement changes — DB-level INSERT/SELECT-only RLS guarantees the ledger cannot be rewritten through the app role. The `status` recomputation goes through one UPDATE on `yard_locations` and is captured by the trailing audit event on the placement.

### 4. Documentation compliance — PASS
- This review; sprint-19 status updated in [docs/09-roadmap.md](../09-roadmap.md); metric registry gains `yard_occupancy` (18 total). Week View aligns with [docs/13-production-planning.md](../13-production-planning.md) § 4.3 — four of the five visualizations are now live (Tavle, Dag, Uke, Ressurser); My Tasks lands in Sprint 20.

### 5. Production-domain compliance — PASS
- The yard module is strictly downstream of `cases` — it never participates in cost/labor/parts aggregates. A movement carries the case forward through physical space; production aggregates continue to read from `work_segments` + `resources`. Week View grew exactly one composer (`WeekSection`) which reuses the existing `listResourcesForBoard`, `listPlannedSegmentsForRange`, and `listApprovedAbsenceWindowsForEmployees` reads — same engine the Resource View built on. Cell-level utilization is the same `planned / available` ratio used everywhere on the board.

### 6. Single-Source-of-Truth compliance — PASS
- `summarizeOccupancy(lines)` and `deriveLocationStatus(line, isBlocked, isReserved)` are the only places that compute yard utilization or transition status. The map view, the admin designer, the dev inspector, the move service's status refresh, and the eight unit tests all call these helpers. The blocked-wins-over-occupied rule, the zero-capacity-never-occupied rule, and the clamp-free-at-zero rule live in one place. No inline percentage arithmetic introduced in presentation.

---

## Testing

- **Unit:** 121 passing (+8 new): eight `summarizeOccupancy` / `deriveLocationStatus` cases (empty-set, single available, single full, blocked-wins, reserved-when-free, multi-line aggregation, zero-capacity guard, partial-fill below threshold).
- **Integration:** +7 new in `yard-management.test.ts`: layout + 3 locations created, move into bay marks occupied, second move appends second movement + frees source slot + occupies destination, single-cap bay rejects with `YardLocationFullError`, blocked slot rejects with `YardLocationBlockedError`, QR-tag resolves and moves the vehicle, unknown QR throws `YARD_QR_NOT_FOUND`.
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (454 modules, cross-module imports only through `public/`), `check:metrics` ✅ (18), `check:permissions` ✅ (24).

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Operations-centric, not feature-centric:** `/yard/map` is reachable from the existing yard sidebar entry via an in-page link (the Sprint 13 transfers view at `/yard` was the obvious anchor); admins reach the designer from `/admin`. Yard work is a frontline, mobile-first activity, so every form on `/yard/map` uses ≥44 px touch targets and a single-column layout below `sm:`.
- **Three Surfaces parity:** every new function ships User + Admin + Dev simultaneously. Techs and coordinators move vehicles (User); admins build and edit the physical map (Admin); platform staff inspect placements + ledger across orgs (Dev).
- **Production Board v3 — one engine, five visualizations:** Week View is the fourth lens on the same underlying data. The Day/Week/Resource composers all share `listResourcesForBoard` + `listPlannedSegmentsForRange` + `absenceMinutesInDay`; switching tabs is a re-projection, never a re-fetch of different data.
- **Norwegian-first:** every new screen pulls from `getDictionary()`. Headings, status labels, kind labels, move reasons, DEPT LOAD legend — all nb-NO by default.
- **Existing UI improved by sprint touch:** the Production page composes a new section (Uke) into the page that already had Tavle/Dag/Ressurser — same surface, more depth. The `/yard` transfers page gains a single discoverable link to `/yard/map`. The admin index lists Tomte-designer next to Fravær and Leiebil from Sprint 18.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- The yard module is orthogonal to estimating/invoicing — a movement is a physical-space event, not a cost event. Placements never mutate the case's estimate, parts, or labor shape. The append-only ledger gives TakstKontroll a future, retrospective view of how long a car sat in each slot (lead-time analytics), without constraining any historical comparison the rule promises.

---

## Three Surfaces verification — PASS
- **User:** `/yard/map` (mobile-first yard map with status-coloured grid, per-layout summary line, move-by-location form, scan-QR form), Production → Uke (week capacity grid + DEPT LOAD).
- **Admin:** `/admin/yard` (layout designer, location form, read-only table of existing locations per layout).
- **Dev:** `/dev/yard` (platform inspector across layouts / locations / active placements / movement ledger; org name resolution per row).

---

## Deferred / follow-ups
- **D1 — Per-org absence-type CRUD UI** — carried from Sprint 18 D3; lands in Sprint 20 alongside org-settings polish.
- **D2 — Cryptographic chained signature on rental agreements** — carried from Sprint 18 D1; lands with customer portal v2 in Sprint 20.
- **D3 — Drag-to-move on the Week View** — Week View is read-only this sprint; the drag interaction (and the simulation-on-drop affordance from doc 13 § 8) lands with My Tasks View in Sprint 20.
- **D4 — Real QR camera capture** — Sprint 19 ships a text-entry "Skann QR" form (works with the phone's keyboard or a hardware scanner); a true camera-in-browser capture defers to Sprint 21 alongside the AI inference flows that also need camera access.

---

## The eight-hour test
The shop owner spends thirty minutes on a Tuesday morning sketching the yard in **/admin/yard** — three bays, four parking slots, one storage spot. The estimator at the front desk receives a brought-in car, opens **/yard/map** on the desk tablet, taps the new case + slot `P1`, reason "Ankomst" — done. Two hours later the body tech walks the car into bay `B1`, scans the QR sticker on the bay's wall with his phone, and the system records the move. After cure time the painter walks it to `B3`, scans again. At end of day the planner opens **Produksjon → Uke** and sees Wednesday's paint load creeping past 100 % — she drags two cases to Thursday in her head before tomorrow's standup, because the answer to "kan vi ta inn én lakkjobb til denne uka?" is now visible from one screen. No spreadsheet. No "let me check with the lead". No paper job tickets.
