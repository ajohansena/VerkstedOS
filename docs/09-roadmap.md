# 09 — Sprint Plan

28 two-week sprints over ~14 months take VerkstedOS from empty repository to a mature, chain-ready, expanded-feature platform with the first signs of platform maturity (advanced analytics, AI foundation, additional integrations).

The plan assumes a small team (2-5 engineers initially, growing to 6-8 by sprint 20) working with heavy AI assistance.

---

## Phase overview

| Phase | Sprints | Duration | Milestone |
|---|---|---|---|
| **1. Foundation** | 1-4 | 8 weeks | Architecture in code; tenancy and audit working; basic Dev Control Plane |
| **2. Operational MVP** | 5-12 | 16 weeks | First friendly workshop runs cases end-to-end |
| **3. Chain MVP** | 13-20 | 16 weeks | General Availability — multi-location chains supported |
| **4. Production maturity** | 21-24 | 8 weeks | Advanced production features, performance hardening, AI foundation |
| **5. Platform expansion** | 25-28 | 8 weeks | Additional integrations, ecosystem growth, multi-region readiness |

```
Sprint 1 ─ Foundation ─ 4
         │
        12 ─ Operational MVP ─ First friendly customer 🎯
         │
        20 ─ Chain MVP ─ General Availability 🎯
         │
        24 ─ Production maturity ─ Advanced workshop capabilities 🎯
         │
        28 ─ Platform expansion ─ Ecosystem-ready platform 🎯
```

---

## Phase 1 — Foundation (Sprints 1-4)

### Sprint 1 — Project skeleton

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-01.md](sprint-reviews/sprint-01.md). External-service provisioning (Supabase / Vercel / Inngest / Sentry projects) is a project-owner action tracked in the sprint review.

**Goal:** Codebase exists, deploys to Vercel, connects to Supabase, has all CI gates.

**Deliverables:**
- Next.js 16 + TypeScript + Tailwind + shadcn/ui scaffolding
- Drizzle ORM + Supabase connection wired
- ESLint + module boundary rules (`dependency-cruiser`)
- Permission catalog drift check + calculation registry coverage check in CI
- Prettier, typecheck (strict mode), Vitest setup
- Sentry + Vercel Analytics wired
- Inngest local dev wiring + production project created
- Supabase project (EU region) provisioned
- Auth flow (Supabase Auth) baseline (email + password)
- Repository conventions documented in `/docs`
- PR template installed (with full Impact Analysis sections)
- Architecture documentation (this package) copied into repo

**Three Surfaces:**
- User: login screen, post-login placeholder
- Admin: none yet
- Dev: `/dev/health` confirms deploy

**Demoable:** A logged-in user can see "Hello, [name]" with their email.

**Risks:** Vercel + Supabase + Inngest integration friction. Budget half a sprint of buffer.

---

### Sprint 2 — Identity & multi-tenancy core

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-02.md](sprint-reviews/sprint-02.md). Tenant-isolation suite (8 tests) passes against real Postgres as a non-superuser role and gates merge from this sprint onward.

**Goal:** Organizations, workshops, departments, users, memberships work. Tenant context propagates correctly.

**Deliverables:**
- `organizations`, `workshops`, `workshop_departments`, `users`, `memberships` tables
- Tenant-aware Drizzle client with `SET LOCAL` session var enforcement
- AsyncLocalStorage request-context propagation
- Org switcher in UI (multi-org users)
- Initial tenant-isolation integration tests
- Customer table with `kind` discriminator (`individual` / `company` / `leasing_company` / `fleet_operator`)
- Vehicle table with separate `owner_customer_id` and `user_customer_id`
- Platform-shared `insurance_companies` catalog seeded (Fremtind, If, Gjensidige, Tryg, Codan, etc.)

**Three Surfaces:**
- User: login → see your org and its workshops; switch orgs
- Admin: minimal admin shell with workshop list
- Dev: `/dev/orgs` (basic list)

**Demoable:** A user belonging to two orgs can switch between them; data is correctly scoped.

---

### Sprint 3 — RBAC

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-03.md](sprint-reviews/sprint-03.md). 24-permission catalog, 6 seeded roles, scope-aware resolver + `app_has_permission()` cache function with trigger refresh; RBAC integration suite (9 tests) proves Technician-vs-Owner and deny-wins.

**Goal:** Permission system in place; standard roles ship.

**Deliverables:**
- `permissions` catalog seed (~24 MVP permissions)
- `roles`, `role_permissions`, `role_assignments` tables
- `user_permission_grants` (grant/deny overrides)
- `has_permission()` SQL function + TS helper
- `effective_permissions_cache` with trigger-driven refresh
- Six standard roles seeded: Owner, Admin, Estimator, Technician, Accounting, Viewer
- Admin UI for user invitation, role assignment, permission viewing
- Permission discipline rule documented and enforced in PR review

**Three Surfaces:**
- User: blocked from actions they lack permission for; clear error messages
- Admin: `/admin/users`, `/admin/roles` for assignment
- Dev: `/dev/users/[id]` (view memberships, role assignments, effective permissions)

**Demoable:** A Technician can clock in but cannot view financial data; an Owner can do everything.

---

### Sprint 4 — Audit + outbox + Dev Control Plane v1

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-04.md](sprint-reviews/sprint-04.md). Partitioned audit + transactional outbox, platform identity track, hardened `/dev` (404 for non-platform), and audit/outbox/isolation suites (22 integration tests) gate merge.

**Goal:** Nothing changes without an audit trail. Tenant isolation proven. Dev Control Plane operational for inspection.

**Deliverables:**
- `audit_events` table partitioned by month
- Audit repository wrapper enforced on full-audit tables
- Tiered audit (full / event / light / none) per data-model spec
- `outbox_events` + Inngest publisher
- RLS policies on every foundation table
- **Tenant isolation integration test suite** (gates merge — this is the bedrock test)
- `platform_users`, `platform_role_assignments`, `platform_permissions`, `platform_role_permissions` tables
- `platform_audit_events` table
- `/dev` route group with hardened middleware (IP allow-list + platform auth)
- `/dev/audit` (cross-org audit log search)
- `/dev/orgs/[id]` (read-only org inspection with health badge)
- `/dev/users/[id]` (read-only user inspection)
- `/dev/inspect` (universal entity search)
- 2FA enforced on platform_users

**Three Surfaces:**
- User: unchanged
- Admin: unchanged
- Dev: audit search, org inspection, user inspection, universal search — all production-quality

**Demoable:** Platform owner searches "reg AB12345" → finds vehicle, navigates to case, sees full audit trail.

**Critical:** No PR can merge after this sprint without passing tenant isolation tests. This is non-negotiable.

---

## Phase 2 — Operational MVP (Sprints 5-12)

### Sprint 5 — Customer & Vehicle

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-05.md](sprint-reviews/sprint-05.md). Customer/vehicle CRUD with audit+outbox, Norwegian checksum validation, owner/user split + ownership history, cached Vegvesen/1881 adapters, and search. Integration suite 31 tests (9 new); validators 9 unit tests.

**Goal:** Workshop can manage customers and vehicles fluently.

**Deliverables:**
- `customers` CRUD with kind-aware UI (individual vs company vs leasing form variants)
- `vehicles` CRUD with owner/user split
- Vegvesen lookup adapter (with caching in `vegvesen_lookups`)
- 1881 lookup adapter (with caching in `phone_lookups_1881`)
- Customer search UI (name, phone, org_no, personnummer)
- Vehicle search UI (reg, VIN, owner)
- Vehicle ownership history tracking
- Norwegian-specific validation (personnummer checksum, orgnummer checksum)

**Three Surfaces:**
- User: customer/vehicle CRUD with smart lookups
- Admin: customer data retention, GDPR export
- Dev: `/dev/inspect` returns customers, vehicles, ownership history

**Demoable:** Estimator types a reg plate → vehicle and owner auto-fill from Vegvesen + 1881.

---

### Sprint 6 — Case core with funding sources

**Status:** ✅ Complete (2026-06-07) — see [sprint-reviews/sprint-06.md](sprint-reviews/sprint-06.md). Cases + the five-kind funding-source model + insurance claims + parties; per-org case numbers, multi-funding validation, intake + detail + search. Integration 36 tests (5 new, incl. the Fremtind+Gjensidige+self-pay demoable); funding validators 8 unit tests.

**Goal:** Cases work with the full multi-funding model from day one.

**Deliverables:**
- `cases` table with all key fields including `incident_tag`
- `case_funding_sources` with all five kinds: `insurance`, `private_pay`, `warranty`, `goodwill`, `internal_rework`
- `insurance_claims` with link to platform-shared insurance_companies
- `case_parties` for non-insurance third parties
- Case intake wizard with funding source allocation
- Case detail page (skeleton — full timeline)
- Case search (number, claim number, reg, customer)
- Multi-funding scenario validation (insurer + deductible + private pay all on one case)

**Three Surfaces:**
- User: create case, add multiple funding sources, view case
- Admin: case configuration (custom case-number format per org)
- Dev: case lookup, funding source inspection, case timeline view

**Demoable:** Estimator creates a case with three funding sources (Fremtind, Gjensidige, customer self-pay) for one repair visit.

---

### Sprint 7 — Estimate import (DBS)

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-07.md](sprint-reviews/sprint-07.md). DBS estimate import as immutable versioned snapshots (draft→active→locked→superseded), per-line funding allocation, integration inbox, `/dev/integrations/dbs`. Periods→hours is an SSoT calc (100 periods = 1 hour). Integration 43 tests (7 new); estimating unit 9 tests.

**Goal:** DBS estimates flow into cases. Funding allocation per line is real.

**Deliverables:**
- DBS file parser adapter (handles the actual DBS export format)
- `estimate_imports` with version lifecycle: DRAFT → ACTIVE → LOCKED
- `estimate_documents`, `estimate_operations`, `estimate_labor_lines`, `estimate_paint_lines`, `estimate_parts`, `estimate_totals` (all immutable when locked)
- Estimate detail UI with funding source allocation per line
- Correction mechanism (24h window or pre-production) with audit
- Supersession via new versions (re-estimate, supplement)
- `integration_inbox` for webhook landing zone

**Three Surfaces:**
- User: drag-drop DBS file → estimate appears with line-by-line funding allocation
- Admin: estimate retention configuration
- Dev: `/dev/integrations/dbs` (import history, parse errors, replay)

**Demoable:** Pia drops a DBS XML into the estimate import → 18 operations allocated to Fremtind, 4 to private pay → locks estimate.

---

### Sprint 8 — Production workflow + event inspection

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-08.md](sprint-reviews/sprint-08.md). Configurable workflow (data, per org), ProductionOrder container, append-only state history, transition machine with **status as projection** (the Sprint 8 guardrail), holds, production board, workflow admin view, and `/dev/events` (outbox/failed/replay). Integration 51 tests (8 new).

**Goal:** Cases move through production states. Workflow is configurable. Events inspectable.

**Deliverables:**
- `workflow_definitions`, `workflow_states`, `workflow_transitions` (configurable per org)
- Default Norwegian collision-repair workflow seeded
- Workflow state categories (active / waiting / terminal) with behavior implications
- `production_orders` table (1:1 with case)
- `production_state_history` (event-audited, append-only)
- State transition machine with permission checks
- Workshop production board UI (basic — list view, color-coded)
- `production_holds` table for waiting states
- `/dev/events/outbox` — outbox publisher monitoring
- `/dev/events/failed` — failed events with manual retry
- `/dev/events/[id]/replay` — manual event replay

**Three Surfaces:**
- User: production board showing all cases by state; transition cases
- Admin: workflow editor (define states & transitions, configure side effects)
- Dev: outbox monitoring, failed event replay, event timeline per case

**Demoable:** Mette views production board with 25 cases color-coded; transitions a case from "Awaiting parts" to "Ready for disassembly"; that emits an event visible in /dev/events.

---

### Sprint 9 — Resources, time & clock

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-09.md](sprint-reviews/sprint-09.md). Employees (separate from users) with multi-skill, resources (person/equipment/facility), shifts, mobile clock-in/out (one-open-session partial unique), event-tier time entries + full-audited corrections, absences. Clock-in carries case+segment (the Sprint 10 driver link). Integration 59 tests (8 new).

**Goal:** Workforce time tracking. Mobile-first clock-in/out.

**Deliverables:**
- `employees` (separate from users — not every employee logs in)
- `employee_skills` with proficiency levels
- `resources` table (people, equipment, facilities) — equipment and facilities introduced
- `shift_definitions` per workshop
- `time_entries` (event-audited original; full-audited corrections)
- `clock_sessions` with partial unique index (one open session per employee)
- Mobile clock-in/out screen (≥56px touch targets, glove-friendly)
- Task time registration on segments
- `absence_types` and `absence_entries` (basic)
- Calendar concept (working hours, holidays)

**Three Surfaces:**
- User: technician clocks in on phone; manager sees who's working
- Admin: employee management, skill catalog, shift definitions
- Dev: clock session inspection, time entry corrections audit view

**Demoable:** Erik clocks in to a paint segment from his phone with gloves on; Mette sees Erik's status update in real-time on her dashboard.

---

### Sprint 10 — Work segments & planning

**Goal:** Cases decomposed into segments. Capacity-aware planning. Drag-and-drop calendar.

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-10.md](sprint-reviews/sprint-10.md). GUARDRAIL ACTIVATION: status is now DERIVED from work activity — a technician clocking into a `work_segment` moves it to `in_progress` and stamps `actual_start_at`; completing a segment recomputes `actual_minutes` from its tagged time entries and emits `production.segment.completed`. Work-segment catalog (23 codes), capacity as an SSoT calculation (computeCapacity/classifyFeasibility, 3 new metrics), resource assignment with conflict surfacing (overlap → `RESOURCE_CONFLICT`, override recorded). Three Surfaces: case-detail segment planning (User), conflict-override policy via `allowConflict` (Admin), `/dev/production` segment inspection + actual-minutes recompute repair (Dev). Integration 64 tests (5 new). Deferred to a later UI-polish sprint: drag-and-drop calendar and the capacity heatmap visualization (the underlying capacity engine + reads ship now).

**Deliverables:**
- `work_segments` table with required_skills, required_equipment_kinds, planned_minutes
- Work segment catalog seeded (~23 default segment codes)
- `tasks` (optional finer-grained decomposition)
- `work_segment_dependencies` (prerequisite chains)
- `resource_assignments` (planned + actual)
- `resource_capacity` calculation engine (per-resource daily capacity)
- `capacity_forecast_snapshots` (forward 14-day projection)
- Drag-and-drop planning calendar (desktop)
- Conflict detection on assignment
- Capacity view per employee/department/workshop
- Work segments tagged with `default_funding_source_id`
- "Simulate accepting this new case" feature

**Three Surfaces:**
- User: drag-drop planning calendar; capacity heatmap
- Admin: planning policies (overbooking allowed/strict), capacity defaults
- Dev: planning event inspection, capacity recalculation tool

**Demoable:** Mette drags a paint segment to Wednesday; calendar shows the booth becomes 100% utilized that day; she confirms.

---

### Sprint 11 — Parts & inventory (operational layer)

**Goal:** Parts flow through full lifecycle. PartRequirement spine in place.

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-11.md](sprint-reviews/sprint-11.md). The PartRequirement spine drives a full lifecycle: flag → order (one PO spans many cases) → receive → withdraw-from-stock → return, with an append-only lifecycle-events timeline and a canonical reconciliation calculation (SSoT: estimated vs ordered vs received vs returned). 13 tables (suppliers, supplier_agreements, part_requirements, purchase_orders/lines, part_receipts/lines, part_returns/lines, inventory_items, inventory_stock_movements [append-only ledger], inventory_withdrawals, part_lifecycle_events [append-only projection]). Parts tagged `funding_source_id` throughout (TakstKontroll case-traceability preserved). Three Surfaces: case parts panel + `/parts` coordinator queue (User), `/admin/suppliers` (Admin), `/dev/parts` requirement inspection + lifecycle timeline + status-rebuild repair (Dev). No new permissions (reused `parts:view`/`parts:order`/`parts:reconcile`). Integration 71 tests (7 new). Supplier-invoice reconciliation (the financial close) is Sprint 13 finance; this sprint delivers the operational + quantity-reconciliation layer.

**Deliverables:**
- `suppliers`, `supplier_agreements` (master data)
- `part_requirements` (the spine, per case)
- `purchase_orders`, `purchase_order_lines` (one PO can span many cases)
- `part_receipts`, `part_receipt_lines`
- `part_returns`, `part_return_lines`
- `inventory_items`, `inventory_stock_movements`, `inventory_withdrawals`
- `part_lifecycle_events` projection (UI timeline)
- Parts UI on case detail
- Parts tagged with `funding_source_id`
- Parts dashboard for purchasing coordinator

**Three Surfaces:**
- User: order parts, receive parts, return parts, withdraw from inventory
- Admin: supplier management, supplier agreements, default lead times
- Dev: part lifecycle inspection, projection rebuild tool, stuck-PO repair

**Demoable:** Body tech flags missing part → coordinator orders → receives → withdraws → lifecycle timeline shows it all.

---

### Sprint 12 — Quality, images, documents + Dev Control Plane expansion + First Friendly Customer 🎯

**Goal:** A complete, friendly workshop can run cases end-to-end. Dev Control Plane reaches "operational" quality.

**Status:** ✅ Complete (2026-06-08) — see [sprint-reviews/sprint-12.md](sprint-reviews/sprint-12.md). The milestone sprint: a friendly Norwegian workshop can run a case end to end, proven by a domain-level **primary-flow E2E** (intake → customer acceptance → production lifecycle → segment work → QC sign-off → signed handover → delivered). Shipped: (1) **i18n** — Norwegian Bokmål (nb-NO) binding default for all user-facing UI; DB/code/APIs stay English. (2) **Documents** + **image upload pipeline** — signed direct-to-storage upload (drag & drop, mobile camera, multiple, progress), thumbnails, full-screen viewer, før/under/etter; sensitivity-class buckets. (3) **Quality control** — per-workshop checklists, pass/fail with comment/photo-on-fail enforced, QC sign-off, deviations with separable internal-rework, failure-rate + rework-rate SSoT metrics. (4) **Case intake UX** — reg/phone search + fast create. (5) **Communication & customer acceptance** — traceable SMS/email threads; the customer approves every repair start via a public job-card link **or** an "OK" SMS reply; status visible at a glance; email backup for customers without a phone. (6) **Digital signatures** — tamper-evident per-case cryptographic chain (verify detects mutation). (7) **Dev Control Plane** — `/dev/documents`, `/dev/quality`, `/dev/communication` inspection; audited **impersonation**; **feature flags** (global + per-org). Gates green: unit 56/56, integration 91/91 (incl. the primary-flow E2E), build. Permissions unchanged (24). Excluded as planned: chain transfer, formal reconciliation, accounting export.

**Localization policy (binding):** primary application language is Norwegian (nb-NO). User-facing labels, navigation, buttons, validation messages and workflows are Norwegian by default; a per-org `settings.locale` may override. Database schema, code, APIs and technical internals remain English.

**Deliverables:**
- `documents` module (table, document_links polymorphic, document_access_events)
- Image upload (mobile + desktop) with virus scan + variant generation pipeline
- Photo gallery on case detail (before/during/after categorization)
- `checklist_templates`, `checklist_template_items`, `checklist_runs`, `checklist_responses`
- QC sign-off flow
- `quality_deviations`
- `digital_signatures` with cryptographic chain
- Communication module: SMS via gateway (LinkMobility or Sveve), email via Resend
- Customer status update emails/SMS
- **Dev Control Plane**: impersonation flow with full audit, feature flags UI, "rebuild projection" repair tool, basic monitoring
- E2E test coverage on the primary flow (intake → estimate → production → delivery)

**Three Surfaces:**
- User: full case lifecycle from intake to delivery with photos, checklists, signatures, customer comms
- Admin: checklist templates, communication templates, retention overrides, feature flag visibility
- Dev: impersonation, document inspection, repair tools, virus scan failure log

🎯 **Milestone — First Friendly Customer**

A single Norwegian collision repair workshop with 8-20 employees can run their entire repair flow on VerkstedOS.

Excluded for now: chain transfer, formal reconciliation, accounting export.

Validation period: 6-8 weeks in production while sprints 13-20 complete. Lessons feed chain MVP work.

**Demoable:** End-to-end repair from customer arrival to delivery, with one funding source (insurance). Use this as the first customer's go-live.

---

## Phase 3 — Chain MVP (Sprints 13-20)

### Sprint 13 — Multi-location case operations

**Goal:** A → B → C → A actually works. The complete-case-across-workshops promise is real.

**Deliverables:**
- `case_assignments` lifecycle (start, end, role, sequence)
- `case_transfers` table with transport tracking
- Transfer workflow UI (initiate, accept at receiving end, confirm arrival)
- Validation: target accepts work type, capacity warning at target, no incomplete blocking segments at source
- Documents follow case (links, not copies) — no document movement needed beyond `document_links` updates
- Notification fires to receiving workshop on transfer initiation
- Cross-workshop yard view: receiving workshop sees inbound transfers
- `current_workshop_id` denormalization on cases (kept in sync via transfer events)
- Operational records (work segments, time entries, photos) keep their original workshop_id

**Three Surfaces:**
- User: transfer case from one workshop to another with one click; receive at destination
- Admin: transfer policies (which workshops can transfer to which, transport providers)
- Dev: transfer history, replay transfer events, repair stuck transfers ("stuck in_transit"), bulk-transfer tool for emergency workshop closures

**Demoable:** Case at Workshop A → transfer to Workshop B for paint → return to A for assembly. Single case timeline visible.

**Risk:** This is the highest-complexity feature in the MVP. End of Sprint 12 should include a dedicated design spike.

---

### Sprint 14 — Parts financial reconciliation

**Goal:** Full financial traceability across the parts lifecycle. One supplier invoice can span many cases.

**Deliverables:**
- `supplier_invoices`, `supplier_invoice_lines` (lines carry case_id; header is org-scoped)
- `supplier_credit_notes`, `supplier_credit_note_lines` (linked to original invoice lines)
- `part_reconciliation_status` projection (estimated vs ordered vs received vs invoiced vs credited)
- Reconciliation UI grouped by funding source per case
- `internal_cost_records` for `internal_rework` and `goodwill` funding sources
- Bulk-receipt and bulk-invoice flows for high-volume workshops
- Email-attachment ingestion path for supplier invoices (manual upload + email forwarding inbox)

**Three Surfaces:**
- User: reconcile parts case-by-case, attach supplier invoices, apply credit notes
- Admin: reconciliation policies (auto-match thresholds, exception routing)
- Dev: reconciliation projection rebuild, invoice-to-case linkage inspection, drift detection

**Demoable:** One supplier invoice covering parts from 4 different cases is split correctly; reconciliation status updates on each case.

---

### Sprint 15 — Invoice basis & accounting export

**Goal:** Invoices generated per funding source. Accounting export to Tripletex working.

**Deliverables:**
- `invoice_basis`, `invoice_basis_lines` generation rules
- One InvoiceBasis per active funding source per case
- Deductible handling (separate InvoiceBasis to deductible_payer_customer_id)
- Internal cost records for rework/goodwill flow into accounting separately
- `accounting_exports`, `accounting_export_lines` (immutable records of what was sent)
- **Tripletex adapter** (first integration based on expected customer pipeline)
- Per-line VAT calculation
- Currency on every money column (NOK enforced for MVP)
- Invoice basis preview / approval flow

**Three Surfaces:**
- User: generate invoice basis, review, send to accounting
- Admin: accounting integration setup, VAT defaults, invoice numbering scheme, export schedule
- Dev: `/dev/integrations/accounting` (export history, retry failed exports, re-send a specific basis)

**Demoable:** Workshop owner approves invoice basis for a delivered case → Tripletex receives invoice ledger entries → audit trail shows the entire chain.

---

### Sprint 16 — Workshop & Workshop Owner dashboards + Production Manager dashboard

**Goal:** The three operational dashboards (Production Manager, Workshop Owner, plus the Painter & Technician mobile dashboards begun in Sprint 9) reach production quality. Single Source of Truth fully enforced.

**Deliverables:**
- Production Manager dashboard (per [11-dashboards.md](./11-dashboards.md))
- Workshop Owner dashboard (per [11-dashboards.md](./11-dashboards.md))
- Painter dashboard production-quality (begun Sprint 9, polished now)
- Body Technician dashboard production-quality
- `kpi_definitions`, `kpi_snapshots` with nightly Inngest job
- All KPIs use canonical calculation services (Single Source of Truth)
- Calculation registry enforcement in CI
- Realtime channels: `workshop:<id>:production`, `workshop:<id>:yard`, `workshop:<id>:notifications`
- `BottleneckDetection` projection running every 5 minutes
- `DeliveryForecast` updated on every relevant event (throttled 30s)
- `/dev/dashboards/perf` — load-time tracking
- `/dev/dashboards/kpi-drift` — alerts on KPI divergence between widgets

**Three Surfaces:**
- User: dashboards live; each role auto-routes to the right one
- Admin: dashboard widget enable/disable per role per org, KPI target configuration
- Dev: dashboard performance monitoring, KPI drift alarms, projection lag visibility

**Demoable:** Production Manager scans her dashboard, sees a red bottleneck indicator (paint booth blocked), clicks it, resolves it; the indicator clears across all dashboards in real-time.

---

### Sprint 17 — Estimator dashboard + Notifications & customer comms

**Goal:** Estimator role gets first-class workflow. Proactive notifications drive the workshop.

**Deliverables:**
- Estimator dashboard (per [11-dashboards.md](./11-dashboards.md))
- `notification_rules` (configurable per org with workshop overrides)
- `notifications`, `notification_deliveries`, `notification_preferences`
- Notification engine with templates, channels (SMS, email, in-app), and routing
- Proactive notification triggers:
  - Missing parts (3-day threshold)
  - Delayed cases (forecast crosses promised date)
  - Deadline approaching (3 days out, low confidence)
  - Missing photos (case ready for delivery without after photos)
  - Capacity conflicts (overbooking detected)
  - Supplement pending (>2 days)
- Customer portal v1 (case status view, document downloads)
- Customer portal token-based access (single-case scope, time-limited)

**Three Surfaces:**
- User: see notifications, customers view their case status portal
- Admin: notification rules configuration, template editor, workshop-level overrides
- Dev: notification delivery inspection, replay failed notifications, customer portal access logs

**Demoable:** Part backorder detected → notification fires → manager sees on dashboard → customer auto-informed via SMS.

---

### Sprint 18 — Absence management & rental

**Goal:** Absence integrates with capacity planning. Rental vehicles tracked.

**Deliverables:**
- `absence_entries` with full integration to capacity engine (reduces resource availability)
- `absence_types` configurable per org (vacation, sick, training, other)
- Calendar UI showing absences with capacity impact
- `rental_vehicles`, `rental_reservations`, `rental_agreements`, `rental_returns`
- Rental availability calendar
- Digital signing of rental agreements (cryptographic chain)
- Rental linked to case via funding source (insurance pays for rental during repair)

**Three Surfaces:**
- User: technician requests vacation; manager approves; customer signs rental agreement
- Admin: rental fleet management, absence type config, rental rate cards
- Dev: rental booking history, agreement signature chain inspection, rental availability projection rebuild

**Demoable:** Painter on vacation Friday → capacity calendar shows reduced paint capacity → planner re-balances; customer signs rental on tablet.

---

### Sprint 19 — Yard management & vehicle movements

**Goal:** Physical vehicle tracking is real-time and accurate.

**Deliverables:**
- `yard_layouts`, `yard_locations` (configurable per workshop)
- `vehicle_placements` (active placement per case)
- `vehicle_movements` (append-only history)
- Mobile yard UI (primary device — phones in pockets)
- Tablet yard UI (wall-mounted, large screen near reception)
- Realtime updates of vehicle positions across all yard views
- QR codes on yard spots (scan to move vehicle, optional)
- Yard map visual: occupied/free/reserved spots, color-coded by case state
- "Where is the car?" universal query surfaced everywhere

**Three Surfaces:**
- User: move vehicles on yard map (mobile or tablet); see at a glance where each car is
- Admin: yard layout designer (define spots, sections, capacity)
- Dev: vehicle movement history inspection, stuck-placement repair, yard occupancy reports

**Demoable:** Body tech scans QR code on a parking spot, taps "Move 4711 here" — manager's dashboard updates instantly.

---

### Sprint 20 — Executive dashboard + polish + General Availability 🎯

**Goal:** GA. Chains can be onboarded. Full Dev Control Plane operational.

**Deliverables:**
- Executive dashboard (per [11-dashboards.md](./11-dashboards.md)) — chain-level KPIs, comparisons, trends
- Cross-workshop capacity sharing visibility
- Insurer-level reporting (revenue, margin, settlement time per insurer)
- Performance hardening (dashboards <1s p95, queries optimized, N+1 eliminated)
- E2E test coverage on critical chain-MVP paths
- **Dev Control Plane**: emergency operations (lock org, pause jobs, force maintenance mode), full repair suite, two-person rule queue for destructive operations
- Capacity planning baseline established (current production loads documented)
- External penetration test passed (findings remediated)
- DPIA completed; subprocessor DPAs in place
- Pre-launch security review checklist completed
- Customer portal v2 (document e-signing, photo viewing)
- Privacy policy + terms of service finalized

🎯 **Milestone — General Availability**

The platform is ready to onboard paying chain customers.

- 1-3 paying customers in production (mix of independents and 1 small chain of 2-4 workshops)
- Tripletex accounting export operational
- Pen-test passed, security review signed off
- Dev Control Plane covers all customer-facing modules
- Postmortem culture established (any P0/P1 produces a Dev Control Plane improvement)
- Capacity headroom for 10× current load

**Demoable:** Anna (chain COO) views her executive dashboard showing 8 workshops with comparative KPIs; identifies an underutilized paint booth at one location and an overloaded one at another; initiates cross-workshop case transfer.

---

## Phase 4 — Production maturity (Sprints 21-24)

### Sprint 21 — AI foundation infrastructure (no models yet)

**Goal:** The infrastructure to add AI features is in place. No specific AI features ship; this is the substrate.

**Deliverables:**
- `ai_model_versions` (platform-level registry of models we support)
- `ai_predictions` (projection — stores predictions linked to source entities)
- AI feature flag framework (every AI feature opt-in per org)
- Prediction event types added to event catalog
- Service interfaces for AI providers (internal model service, OpenAI-compatible, custom)
- AI explainability requirements baked in (every prediction must store its inputs and rationale)
- Sentry instrumentation specifically for AI calls (latency, cost, accuracy when ground-truth known)
- Audit requirements: every AI prediction that affects a decision is recorded with the prediction value and the user's actual choice

**Three Surfaces:**
- User: no user-facing AI yet
- Admin: per-org AI feature toggles (all default OFF)
- Dev: `/dev/ai/predictions` (view predictions across all orgs), `/dev/ai/models` (model registry, version status, latency monitoring)

**Demoable:** Platform engineer registers a new model version; flips a flag for one test org; predictions start flowing into the projection table; the org's admin can see the model is active.

---

### Sprint 22 — Advanced capacity & delivery forecasting

**Goal:** Forecasts are dramatically more accurate. Historical-variance learning operational.

**Deliverables:**
- Historical variance tracking per segment_code per workshop per technician
- Forecast model V2: incorporates historical variance, applies confidence intervals more accurately
- "Delay risk" categorization (low / medium / high) with explanations
- Critical-path computation per case (which segments are on the critical path right now)
- `delivery_forecast_history` exposed in UI for trust-building ("here's how our forecast evolved over time")
- Customer-facing promised delivery vs internal forecast separation; configurable buffer
- Automatic at-risk events (`delivery.commitment_at_risk`) with notification routing
- Cure time profiles per paint type (configurable per org)
- Paint booth slot scheduling improvements (cure-time-aware planning)

**Three Surfaces:**
- User: forecast confidence is more nuanced; delay-risk badges meaningful; planning UI shows critical path
- Admin: paint cure profiles, historical-variance feedback exposure, confidence-band tuning
- Dev: forecast accuracy retrospective (predicted vs actual), historical variance tables, model debug

**Demoable:** Forecast for a case starts at 0.9 confidence; supplement discovered drops it to 0.5; parts delay drops to 0.35; recovery actions bring back to 0.7; complete forecast history visible.

---

### Sprint 23 — Two-way DBS sync + additional accounting integrations

**Goal:** DBS becomes bidirectional. More accounting partners onboarded.

**Deliverables:**
- Two-way DBS sync: workshop updates flow back to DBS (status, completion dates, photos where supported)
- DBS supplement submission via API (not just file upload)
- PowerOffice integration (second accounting integration)
- Visma integration (third accounting integration)
- Per-org accounting integration choice; each org picks one
- Integration health dashboard improvements (per-customer status)
- Outbound webhook subscriptions for third-party integrations
- API key management UI for customers (rotate, scope, audit)

**Three Surfaces:**
- User: DBS-status sync invisible (just works); accounting workshops choose their integration
- Admin: accounting integration setup wizard per org; webhook subscription management for customers
- Dev: per-integration health metrics, webhook delivery logs, API key inventory across all orgs

**Demoable:** Norwegian workshop using PowerOffice instead of Tripletex onboards smoothly; case status update from VerkstedOS appears in DBS automatically.

---

### Sprint 24 — Performance, observability, scalability hardening

**Goal:** Platform ready for substantial scale. Internal tools mature.

**Deliverables:**
- Query optimization pass (top-100 slow queries from production logs)
- Materialized view rebuild scheduling refined
- Connection pool tuning (Supavisor configuration)
- Per-tenant query budgets and rate limiting
- Read replica for analytics workloads (if metrics indicate need)
- Image storage lifecycle: cold storage migration at 12 months post-case-closure
- Audit partition archival to cold storage at 24 months
- Comprehensive system health dashboard (Dev Control Plane)
- Sentry quota management; cost alerting on infrastructure spend
- Load testing baseline (k6) — documented 10× current load capacity
- Backup restoration drill executed and documented
- DR runbook tested

**Three Surfaces:**
- User: noticeably faster everywhere
- Admin: usage analytics now visible per org
- Dev: comprehensive health view, performance regression detection, automated alerting

**Demoable:** Platform engineer runs load test against staging at 10× production scale; system holds; report shared with team.

---

## Phase 5 — Platform expansion (Sprints 25-28)

### Sprint 25 — Customer portal v3 + Insurance company portal v1

**Goal:** Customer self-service deepens. Insurers can read their own claims.

**Deliverables:**
- Customer portal v3: full case visibility, photo gallery, document signing, deductible payment integration
- Customer satisfaction surveys (post-delivery, configurable)
- NPS tracking
- Insurance company portal v1 (insurer claim handlers can see read-only their own cases)
- Insurer access provisioned per insurance company, scoped to their claims only
- Insurer dashboard showing claim status, photos, documents, communications log
- Notification routing to insurer for status changes

**Three Surfaces:**
- User: customers self-serve more; insurers can answer their own internal questions without calling
- Admin: customer portal customization (workshop logo, language), insurer access provisioning
- Dev: portal access logs, insurer access audit, customer portal token management

**Demoable:** Customer signs in to portal, reviews repair photos, signs deductible agreement, schedules pickup; insurer claim handler views same case from their portal with insurer-specific data only.

---

### Sprint 26 — Supplier integrations + NFC time registration

**Goal:** Parts ordering integrates with major suppliers. NFC clock-in becomes available.

**Deliverables:**
- Adapter for at least 2 major Norwegian parts suppliers (e.g. Mekonomen, Auto-Help — choice based on customer pipeline)
- Automated PO submission via supplier API
- Automated delivery confirmation when supplier sends ASN
- Backorder ETA updates flow automatically
- NFC time registration: technicians tap a workshop NFC tag to clock in/out
- NFC-tag-to-segment mapping (tap the right segment to start it)
- Time entries from NFC carry source attribution for audit
- PWA enhancements: Web NFC API on supported devices

**Three Surfaces:**
- User: order from supplier with one click; technicians tap to clock in
- Admin: supplier API credentials, NFC tag provisioning per workshop
- Dev: supplier integration health, NFC event log, ambiguous-tap diagnostics

**Demoable:** Coordinator orders part → supplier auto-confirms → backorder ETA arrives via webhook; technician taps NFC tag at booth entrance → automatically clocked into paint segment.

---

### Sprint 27 — Multi-region readiness + advanced analytics

**Goal:** Platform prepared for non-Norwegian deployment. Customer-facing analytics richer.

**Deliverables:**
- Locale framework expanded (English UI variant production-ready; Swedish and Danish stub locales)
- Multi-currency support enabled in business logic (per-org currency configuration)
- VAT-rate flexibility (configurable per region)
- Sweden- and Denmark-specific compliance research documented (Bokföringslag, Bogføringsloven)
- Advanced analytics dashboards: technician performance trends, insurer profitability deep-dive, capacity utilization heatmaps over time
- Configurable executive reports (PDF export, scheduled email)
- BI export API (read-only, customer-configurable, for external Power BI / Tableau use)
- Region-aware data residency planning (Frankfurt + Stockholm options for EU customers)

**Three Surfaces:**
- User: English UI now production-quality
- Admin: locale and currency configuration per org; BI export setup
- Dev: region-aware deployment readiness checklist, locale coverage report

**Demoable:** A Swedish workshop owner views English UI with SEK pricing; analytics dashboard shows 24-month trends.

---

### Sprint 28 — Polish, retrospective, planning the next year

**Goal:** Mature platform. Lessons captured. Roadmap for year 2 defined.

**Deliverables:**
- Comprehensive UX audit and polish pass
- Onboarding flow for new workshops (self-service for small shops; assisted for chains)
- Documentation portal for workshop users (in-app help, video walkthroughs, FAQ)
- Public-facing customer documentation
- Engineering onboarding documentation updated
- Postmortem culture metrics (incidents, resolution time, recurring root causes)
- Cost-per-workshop infrastructure analysis
- Customer satisfaction baseline (NPS, churn risk indicators)
- Year-2 roadmap planning (TakstKontroll, AI-powered scheduling, additional EU markets)
- All architecture documents updated to reflect what was built vs originally planned

🎯 **Milestone — Platform Maturity**

VerkstedOS is a mature, multi-customer, multi-region-ready platform with:
- 5-15 paying customers (mix of independents and chains)
- Strong operational metrics (uptime, response time, customer satisfaction)
- Path to next-tier features (AI, TakstKontroll, new geographies) clearly mapped
- Engineering team scaled appropriately (8-12 people)
- Dev Control Plane covering virtually all operational scenarios

**Demoable:** A new workshop onboards via self-service in under 30 minutes; first case running in under 2 hours.

---

## Critical dependencies

```
Sprint 1 (skeleton)
  └─► Sprint 2 (tenancy)
        └─► Sprint 3 (RBAC)
              └─► Sprint 4 (audit + Dev CP v1)  ← gate for everything else
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
   Sprint 5    Sprint 8     Sprint 9    Sprint 11
   Customer    Workflow     Workforce   Parts
        │           │           │           │
        ▼           ▼           ▼           ▼
   Sprint 6    Sprint 10     ...         Sprint 14
   Cases       Planning                  Reconciliation
        │
        ▼
   Sprint 7
   Estimates
        │
        ▼
   Sprint 12 ──► First Friendly Customer 🎯
        │
        ▼
   Sprint 13 (multi-location — critical)
        │
        ▼
   Sprints 14-19 (chain features)
        │
        ▼
   Sprint 20 ──► General Availability 🎯
        │
        ▼
   Phase 4 (sprints 21-24): maturity
        │
        ▼
   Phase 5 (sprints 25-28): expansion ──► Platform Maturity 🎯
```

Sprints 1-4 are serially dependent. After Sprint 4, parallel streams open up:
- Customer/Case (5, 6, 7) — Estimator team
- Production (8, 10) — Production team
- Workforce (9) — Workforce team
- Parts (11) — Parts team
- All converge in Sprint 12

Sprint 13 (multi-location) is highest complexity. Design spike at end of Sprint 12 is mandatory.

---

## Team scaling assumptions

| Phase | Sprint range | Engineers | Notes |
|---|---|---|---|
| Foundation | 1-4 | 2-3 | Founder + 1-2 senior engineers; deep architecture work |
| Operational MVP | 5-12 | 3-5 | Add 1-2 mid/senior engineers around Sprint 6 |
| Chain MVP | 13-20 | 5-8 | Add another 2-3 engineers; first hire of dedicated platform engineer |
| Production maturity | 21-24 | 6-10 | Add AI/ML capability; possibly first hire of dedicated security |
| Platform expansion | 25-28 | 8-12 | Add localization expertise; possibly geographic / market-specific hires |

Heavy AI assistance throughout. The team is small relative to the surface area; this works because:
- Modular monolith keeps cognitive load manageable
- Strict module boundaries prevent cross-module entanglement
- Calculation registry prevents reinvention
- Dev Control Plane reduces firefighting time
- Three Surfaces Rule front-loads operational consideration

---

## Risk register (evolves through the plan)

### Risks present throughout

| Risk | Mitigation |
|---|---|
| **Tenant isolation regression** | Integration test suite gates every PR; tested as bedrock |
| **Module boundary erosion** | dependency-cruiser in CI; refactor before adding features |
| **Calculation duplication (SSOT violation)** | Registry coverage in CI; ESLint flagging arithmetic in presentation |
| **Permission catalog explosion** | Permission discipline rule; quarterly audit |
| **Dev Control Plane falling behind** | Three Surfaces Rule per PR; dedicated capability work in sprints 4, 8, 12, 16, 20, 24, 28 |

### Phase-specific risks

| Sprint | Risk | Mitigation |
|---|---|---|
| 1-4 | Vercel + Supabase + Inngest integration friction | Buffer half a sprint; have engineer with prior Supabase experience |
| 7 | DBS file format complexity / vendor relationship | Adapter pattern; immutable raw import; spike during Sprint 6 |
| 10 | Capacity engine performance | Pre-compute snapshots; cap forecast window at 14 days for MVP |
| 12 | First-customer churn risk before chain MVP completes | Recruit 2 friendlies, not 1 |
| 13 | Multi-location complexity underestimated | Design spike at end of Sprint 12; budget Sprint 13.5 of slack |
| 15 | First accounting integration choice wrong | Pick Tripletex based on customer pipeline; if wrong, slot PowerOffice into Sprint 16-17 instead |
| 17 | Notification spam / fatigue | Per-user notification preferences; conservative defaults |
| 20 | Pen-test surfaces major issues | Schedule pen-test at end of Sprint 18, not Sprint 20; gives time to remediate |
| 21 | AI hype-cycle pressure to ship visible AI fast | Resist; build foundation, ship judiciously |
| 23 | Two-way DBS sync more complex than read-only | Phased rollout (status sync first, then richer data) |
| 25 | Customer portal expansion ahead of customer demand | Validate via customer interviews before building |
| 27 | Multi-region complexity larger than expected | Stop at "ready" — actual non-Norway launch can be year 2 |

---

## Milestone summary

| Milestone | When | Definition of done |
|---|---|---|
| **🎯 First Friendly Customer** | End of Sprint 12 | A single workshop runs cases end-to-end in production for 6+ weeks |
| **🎯 General Availability** | End of Sprint 20 | 1-3 paying customers including 1 chain; pen-test passed; full Dev Control Plane operational |
| **🎯 Production Maturity** | End of Sprint 24 | AI foundation, advanced forecasting, multi-accounting integrations, scalability proven at 10× |
| **🎯 Platform Maturity** | End of Sprint 28 | 5-15 customers; multi-region-ready; ecosystem integrations live; year-2 roadmap defined |

---

## Non-negotiables that hold every sprint

From [07-governance.md](./07-governance.md):

1. **System Impact Analysis** completed for every change — no exceptions
2. **Three Surfaces** defined (User / Admin / Dev) for every feature — no exceptions
3. **Single Source of Truth** for every calculation — drift caught in CI
4. **Tenant isolation tests** pass on every PR — gates merge
5. **Module boundary checks** pass — dependency-cruiser in CI
6. **No raw SQL** in service code — ESLint rule
7. **New permissions** require written justification — PR review enforces
8. **Audit completeness** on every state-changing action — repository wrappers enforce

These don't become optional under deadline pressure. They become more important.

---

## What this plan does NOT include

Deferred to year 2+:

- **TakstKontroll** as a separate product or VerkstedOS module (kept clean enough to add)
- **Native mobile apps** (PWA-only through year 1)
- **Live AI scheduling** (foundation in Sprint 21; live models year 2)
- **Active expansion to Sweden / Denmark** (technical readiness in Sprint 27; commercial expansion year 2)
- **Insurance company API integration** (read-only portal in Sprint 25; full integration year 2)
- **Marketplace features** (workshops trading parts, sharing capacity) — speculative, not committed
- **Advanced supply chain features** beyond basic supplier integration

---

## Closing principle

This plan is a forecast, not a contract. It will change. The architecture, governance rules, and process discipline are what make replanning safe — when reality diverges from the plan, the system itself doesn't have to be rewritten.

Every sprint produces something demoable. Every sprint defines its Three Surfaces. Every sprint contributes to a maturing Dev Control Plane. Every sprint adds tests and never removes them.

The success criterion is not "we shipped the plan." The success criterion is "after 28 sprints, Norwegian collision repair workshops run better because of VerkstedOS."
