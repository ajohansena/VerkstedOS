# Sprint 18 Implementation Review — Absence approval + Rental subsystem + Production Board v3 Resource View

**Status:** Complete
**Date:** 2026-06-09
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:**

1. A painter opens **Fravær** and submits a vacation request for next Friday. The shop owner opens **/admin/fravær**, sees the pending request, and approves it. Within seconds the **Production** page → **Ressurser** tab shows that painter's row dropping from 100 % to 0 % capacity on that day — the planner can now re-balance the workshop's bookings around the gap.
2. A coordinator opens **Leiebil** and registers a rental for an insurance case: picks an available vehicle from the fleet, books a date range (the system rejects an overlapping reservation against the same vehicle), then captures a customer signature on a tablet. The signed agreement appears in the list; later, on return, a fuel/odometer reading is logged and the vehicle returns to the available pool.
3. The platform inspector opens **/dev/rental** and sees every reservation, agreement, return and absence across all orgs — the same Dev Control Plane discipline the rest of the platform follows.
4. The Production Board v3 ships its **third visualization**: **Ressurser**. Same underlying engine as Day View, different lens — a 7-day heat-grid per resource with traffic-light utilization (emerald < 85 %, amber 85–100 %, red > 100 %), absence minutes subtracted from available capacity by the SSoT `absenceMinutesInDay` helper.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| Absence approval workflow (request → approve / decline / cancel) | ✅ | `status`, `requestedBy`, `requestedAt`, `decidedBy`, `decidedAt`, `decisionReason` added to `absence_entries` |
| Absence integrates with capacity engine | ✅ | `absenceMinutesInDay` SSoT in `production/application/calculations/capacity.ts`; registered as metric `absence_minutes_in_day`; subtracted from available capacity by Resource View |
| Absence type seeding (vacation/sick/training/other) | ✅ | `ensureDefaultAbsenceTypes()` idempotent per org; labels Norwegian-first |
| `rental_vehicles` + `rental_reservations` + `rental_agreements` + `rental_returns` (4 tables + 3 enums) | ✅ | migration `0041_absence_rental_tables.sql` + RLS in `0042_absence_rental_rls.sql` |
| Rental availability (overlap check, SSoT) | ✅ | `hasConflict` + `projectAvailability` in `rental/application/calculations/availability.ts`; `createReservation` rejects with `RentalConflictError` |
| Rental signing | ✅ | `signAgreement` records signer name + timestamp + transitions `agreement.status` to `signed`; outbox emits `rental.agreement.signed` |
| Rental return | ✅ | `recordReturn` captures odometer + fuel + notes; vehicle becomes available again; outbox emits `rental.return.recorded` |
| Production Board v3 — Resource View | ✅ | per-resource × 7-day grid; planned vs available; absence subtracted via SSoT; traffic-light bands per docs/13 |
| Three Surfaces (User / Admin / Dev) | ✅ | user `/fravær` + `/leiebil`; admin `/admin/fravær` (queue) + `/admin/rental` (fleet); dev `/dev/rental` (platform inspector across 5 datasets) |
| Topbar / sidebar surfaces | ✅ | Sidebar secondary group gains `Fravær` + `Leiebil` (`UserMinus`, `Car` icons); admin index gates new links on `canConfig` |
| Cryptographic signature chain on rental agreements | ⏸ Deferred (D1) | Sprint 18 records signer + timestamp on the agreement row (auditable). The full append-only chained signature (per `digital-signatures.test.ts`) lands when external e-signing is wired in Sprint 20 (customer portal v2). |
| Rate-card pricing on rentals | ⏸ Deferred (D2) | rental schema reserves `dailyRateCents` on agreements; rate-card configuration screens defer to Sprint 20 alongside the executive dashboard pricing surface |
| Per-org absence-type configuration UI | ⏸ Deferred (D3) | seeded defaults cover today's flows; per-org CRUD UI defers to Sprint 19 (yard sprint already touches `/admin`) |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All four new rental tables carry `organization_id NOT NULL` with FORCE RLS and an `org_isolation` policy (migration `0042_absence_rental_rls.sql`). Absence approval columns extend the existing `absence_entries` table — its FORCE RLS policy continues to enforce isolation. Every service call goes through `withTransaction(ctx, …)` so RLS sees `app.current_org_id`; the platform inspector page is the only cross-org read path and goes through `getRawClient({as: 'platform-inspector'})`. The harness's `app_user` role exercises real RLS — no GRANTs in the new migration (consistent with every prior RLS migration; the harness grants table privileges once). Tenant-isolation suite green.

### 2. RBAC compliance — PASS
- `requestAbsence`, `cancelAbsence` → `time:self` (the requesting user manages their own absence). `approveAbsence` + `declineAbsence` → `admin:config` (only org admins can approve; declines require a reason — enforced in the service). `createReservation`, `signAgreement`, `recordReturn` → `case:edit` (coordinators / estimators). `registerRentalVehicle` → `admin:config` (fleet management is an admin operation). **No new permissions — catalog stays frozen at 24** (`check:permissions` green). Admin index hides both new links behind `canConfig`; sidebar shows the user-facing entries unconditionally; dev inspector is gated by the `/dev` layout.

### 3. Audit compliance — PASS (tiered correctly)
- Rental lifecycle emits outbox events at every transition: `rental.vehicle.registered`, `rental.reservation.created`, `rental.agreement.signed`, `rental.return.recorded`. Past-tense, per audit discipline. Absence approval mutations (`approveAbsence`, `declineAbsence`, `cancelAbsence`) call `recordAuditEvent` with `decision_reason` captured for declines. The `signed_at` / `signed_by` / `returned_at` columns are themselves the audit trail for portal-facing customer interactions, mirroring the Sprint 12 signing model.

### 4. Documentation compliance — PASS
- This review; sprint-18 status updated in [docs/09-roadmap.md](../09-roadmap.md); metric registry gains `absence_minutes_in_day` (17 total). The Resource View visual aligns with [docs/13-production-board-v3.md](../13-production-board-v3.md) — three of the five visualizations are now live (Tavle, Dag, Ressurser); Week and My Tasks land in Sprints 19–20.

### 5. Production-domain compliance — PASS
- The capacity engine grew exactly one helper: `absenceMinutesInDay(windows, day)` which merges overlapping approved-absence windows and clips them to the working day. The Resource View composer subtracts those minutes from a 09:00–17:00 baseline (480 min/day) and from the workforce repository's planned-segment totals. No production aggregate touched. Rental never participates in production capacity — it is a tracked side-resource bound to a case via `funding_source_id`.

### 6. Single-Source-of-Truth compliance — PASS
- `absenceMinutesInDay` has exactly one implementation; the Resource View, the admin queue's "impact preview" hint, and any future capacity report all call the same helper. `hasConflict` / `projectAvailability` for rentals are similarly single-source — `createReservation` and the Resource View calendar both use them. No inline arithmetic on minutes, capacity percentages, or overlap math introduced in presentation.

---

## Testing

- **Unit:** 113 passing (+13 new): seven `absenceMinutesInDay` cases (empty/degenerate/contained/clipped/merging-overlapping/disjoint/outside) and six rental availability cases (no-overlap-when-disjoint, exact-touch, contained, exact-match, multi-overlap, projection over date range).
- **Integration:** 124 passing across 22 files (+7 new): `absence-approval.test.ts` (range invalid, request → approve flow makes the absence visible to capacity, decline requires reason, cancel) and `rental-lifecycle.test.ts` (register + reserve + overlap-rejected, sign + return, empty signer rejected).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (438 modules, cross-module imports only through `public/`), `check:metrics` ✅ (17), `check:permissions` ✅ (24).

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Operations-centric, not feature-centric:** Fravær and Leiebil sit in the sidebar's secondary group, exactly where techs/coordinators reach during a shift — not buried in admin or in a separate menu.
- **Three Surfaces parity:** every new function ships User + Admin + Dev simultaneously. Customers (User) request; managers (Admin) approve and manage fleet; the platform (Dev) inspects across orgs.
- **Production Board v3 — one engine, five visualizations:** Resource View is the third lens on the same underlying data. Mode tabs (URL-driven) let a planner switch from Tavle to Dag to Ressurser without losing context. The Week and My Tasks tabs remain placeholders until Sprints 19–20.
- **Norwegian-first:** every new screen pulls from `getDictionary()`. Headings, status labels, button text, and metric labels are nb-NO by default.
- **Existing UI improved by sprint touch:** the Production page composes a new section (Ressurser) into the page that already had Tavle/Dag — same surface, more depth. The admin index lists the two new admin destinations alongside the existing ones.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- Rental is a case-traceable side-resource (the `funding_source_id` FK ties a rental to its insurance funding source). The signed-agreement row stores signer + timestamp without mutating any estimate/invoice/parts shape. Absence approval extends `absence_entries` with status workflow columns — the existing capacity-impact field stays canonical. Nothing introduced here would constrain TakstKontroll's later retrospective comparisons.

---

## Three Surfaces verification — PASS
- **User:** `/fravær` (submit + see own absences for last 30 days), `/leiebil` (book a rental, sign an agreement, record a return), Production → Ressurser (capacity view).
- **Admin:** `/admin/fravær` (approval queue; approve / decline-with-reason), `/admin/rental` (fleet management; register vehicles).
- **Dev:** `/dev/rental` (platform inspector across vehicles / reservations / agreements / returns / absences).

---

## Deferred / follow-ups
- **D1 — Cryptographic chained signature on rental agreements** — Sprint 18 records signer + timestamp on the agreement row (auditable, immutable from app role). Full chained signature lands when external e-signing arrives in Sprint 20 (customer portal v2).
- **D2 — Rate-card pricing on rentals** — schema reserves `dailyRateCents`; configuration UI defers to Sprint 20.
- **D3 — Per-org absence-type configuration UI** — seeded defaults cover today's flows; per-org CRUD UI defers to Sprint 19.
- **D4 — Production Board v3 Week / My Tasks** — placeholders ship; each becomes real in Sprints 19–20 per the roadmap.

---

## The eight-hour test
The painter requests Friday off on her phone before clocking out for the day. The owner approves it Saturday morning from his kitchen. By Monday the planner opens the Production page → Ressurser tab and sees Friday's paint capacity already adjusted — no second system to update, no spreadsheet, no surprises. A coordinator pulls a rental for an insurance case at the front desk, captures the customer's signature on a tablet in twenty seconds, and the system rejects a double-booking on the same vehicle before anyone notices. When the customer returns the car two weeks later, the odometer and fuel reading is captured on the same screen, the vehicle goes back into the available pool, and the platform inspector can verify any of it across any org.
