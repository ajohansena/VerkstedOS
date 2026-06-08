# Sprint 14 Implementation Review — Operations Center, Production Board v2, Case Workspace & Supplier Invoicing (Milestone: "Would they enjoy using it for eight hours a day?")

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:** A user signs in and lands on the **Operations Center** — a live, role-shaped command surface (Attention / Flow / Pulse) built entirely from the org's real data. From there they run the day: the **Production Board v2** shows operationally-rich cards (vehicle, customer, assigned tech, segment progress, parts status, hold, risk dot) and supports **drag-to-transition** gated by the workflow graph; the **Case Workspace** carries a sticky right-side panel and a status-change **drawer** (no full-page hops); the **/parts** surface registers a **supplier invoice spanning multiple cases** and credits it — all case-traceable; and every list (`/cases`, `/vehicles`) is now a dense, scannable, Norwegian operational view.

This sprint was a binding UX-maturity directive: the backend had outrun the frontend and the UI felt like a proof-of-concept. The mandate — *bake docs 11 + 12 patterns into every screen, no placeholder UI from now on, and at the end ask "would a Norwegian collision-repair workshop actually enjoy using this screen for eight hours a day?"* The supplier-invoice spine (the roadmap's planned Sprint 14 finance layer) was delivered as Track F inside the same sprint.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Binding directive (this sprint): UX maturity, no placeholders

1. **Operations Center is the post-login landing.** Implemented at `src/app/(app)/page.tsx`: a three-zone surface (Attention / Flow / Pulse) composed by `src/lib/operations/snapshot.ts` from module publics only. Every Attention item is actionable (links to the case or surface that resolves it); every Pulse tile clicks through to where work happens.
2. **Production Board cards carry substantially richer operational information.** New SSoT read `listProductionBoardRich` powers cards with reg, vehicle, customer, opened-days, ETA, assigned technician, active segment + progress bar, parts badge, hold pill, and a risk dot from the canonical `classifyCaseRisk`.
3. **Case Workspace prefers drawers / side panels / inline editing over full-page navigation.** A sticky right-side panel (delivery ETA, vehicle, customer, funding, tech, quick actions) plus a right-side status-change drawer (`Dialog side="right"`).
4. **No placeholder pages from Sprint 14 onward.** `/cases`, `/vehicles`, `/parts`, `/admin`, `/admin/workflow` were all rewritten to deliver real operational value; mixed-English headings and redundant "Home" backlinks were removed (the shell handles navigation).

---

## Deliverables: planned vs shipped

| Track | Deliverable | Status | Notes |
|---|---|---|---|
| A | App shell (persistent sidebar + topbar, `(app)` route group) | ✅ | sidebar/topbar/dialog; URLs unchanged via `git mv` into `src/app/(app)/` |
| B | ⌘K command palette | ✅ | debounced server search over cases/vehicles/customers + goto/actions |
| C | Operations Center (Attention / Flow / Pulse) | ✅ | `getOpsSnapshot`; greeting by hour; default landing |
| D | Production Board v2 | ✅ | rich cards; HTML5 drag-to-transition; server re-validates via `transitionState` |
| E | Case Workspace lift | ✅ | sticky side panel + status drawer; English header chrome stripped |
| F | Supplier invoicing (the roadmap's Sprint 14 finance) | ✅ | 4 tables + RLS; invoice spans many cases; credit notes; `calculateInvoiceMatch` SSoT |
| G | Rich lists + actionable admin + language sweep | ✅ | `/vehicles` case-stats table; `/cases` Linear-style rows; `/admin` inline org+workshop edit; `/admin/workflow` rename |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Four new tables (`supplier_invoices`, `supplier_invoice_lines`, `supplier_credit_notes`, `supplier_credit_note_lines`) are `organization_id`-scoped with FORCE RLS (migration `0034_supplier_invoice_rls.sql`, modelled on `0020`). Platform inspectors get read access via `app_is_platform_inspector()`. Invoice numbers are unique per supplier within an org. Tenant isolation suite still green (17 integration files, 104 tests).

### 2. RBAC compliance — PASS
- Supplier invoicing reuses `parts:reconcile` (write) and `parts:view` (read). Admin config (org settings, workshop create, workflow rename) reuses `admin:config`. Drag-to-transition reuses `production:transition`. **No new permissions — catalog stays frozen at 24** (`check:permissions` green).

### 3. Audit compliance — PASS (tiered correctly)
- All supplier-invoice mutations (`createSupplierInvoice`, `addInvoiceLine`, `bookInvoice`, `createCreditNote`, `addCreditLine`) and admin-config mutations (`updateOrganizationSettings`, `createWorkshop`, `renameWorkflowState`) are full-audited via `recordAuditEvent` (past-tense actions). New outbox events: `parts.supplier_invoice.created/booked`, `parts.supplier_credit_note.created`.

### 4. Documentation compliance — PASS
- This review; two new metrics registered (`case_risk` → `operations/classifyCaseRisk`, `supplier_invoice_match` → `parts/calculateInvoiceMatch`); `check:metrics` green (10 metrics). UX maturity directive recorded in repo memory.

### 5. Production-domain compliance — PASS
- No production aggregate simplified. Drag-to-transition is a thin client over the existing history-driven `transitionState` (the board never writes status directly). `classifyCaseRisk` is a pure projection over openedAt / holds / parts / state category — advisory, not a new source of truth. Cards render the PROJECTED workflow state ordered by `sequenceNo`.

### 6. Single-Source-of-Truth compliance — PASS
- New calculations are pure and registered: `classifyCaseRisk` (risk), `calculateInvoiceMatch` (three-way received-vs-invoiced-vs-credited match). `calculateInvoiceMatch` is a *separate* calc — `reconcilePartRequirement` remains the sole owner of `part_reconciliation`. TakstKontroll (§ 4.7): every invoice/credit line preserves `case_id` + `funding_source_id`, never collapsing estimated vs billed into a single flag.

---

## TakstKontroll guardrail (§ 4.7) — preserved
A single supplier invoice can span several cases; each line carries `case_id`, `funding_source_id`, and optionally `purchase_order_line_id` + `part_requirement_id`. The integration test asserts two cases on one invoice and a credit note that flips the invoice to `credited` while keeping the per-case attribution intact.

---

## Testing

- **Unit:** 63 passing (7 new in `invoice-match.test.ts` covering not_invoiced / under_invoiced / invoiced / over_invoiced / credit-netting / credited / negative-floor).
- **Integration:** 104 passing across 17 files (new `supplier-invoicing.test.ts`: register multi-case invoice → add lines → book → reject re-book → credit note → unique-number enforcement, all against real Postgres + RLS).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (352 modules, cross-module imports only through `public/`), `check:metrics` ✅ (10), `check:permissions` ✅ (24).

---

## Deferred / follow-ups
- **D1 — Reconciliation UI grouped by funding source per case.** The supplier-invoice *spine* + the `calculateInvoiceMatch` SSoT ship now; the per-case grouped reconciliation view and auto-match thresholds move to the next finance iteration (originally Sprint 15 territory).
- **D2 — `internal_cost_records` + bulk receipt/invoice + email-attachment ingestion** (roadmap Sprint 14 finance extras) — deferred; not required for the UX-maturity milestone.
- **D3 — Activity timeline as the Case Workspace spine** — the side panel + status drawer landed; the unified projected timeline (state history + audit + comms + part lifecycle) is the next Case Workspace increment.
- **D4 — Board group-by Department/Technician** — Status grouping ships; the selector for Department/Technician is stubbed for the next board iteration.

---

## The eight-hour test
Every screen touched this sprint was measured against *"would a Norwegian collision-repair workshop enjoy using this for eight hours a day?"* The Operations Center answers "what needs me now" in one glance; the board shows real cars and real progress, not status words; the case workspace keeps context while acting; the lists are dense and Norwegian. Placeholder UI is gone from the visible surfaces.
