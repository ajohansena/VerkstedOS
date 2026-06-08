# Sprint 11 Implementation Review — Parts & Inventory (operational layer)

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main`.
**Demoable outcome:** Confirmed in tests — a body tech flags a missing part (`Frontlykt H`) on a case; the coordinator creates ONE purchase order that also carries a line for a SECOND case (proving a PO spans many cases), sends it, and receives the part → the requirement reconciles to `received`/fulfilled; a stocked part (`Motorolje 5W30`, 10 on hand) is withdrawn to the case (alternative satisfaction path) → stock drops to 8 via the append-only ledger and the requirement is `fulfilled`; an over-quantity withdrawal is rejected; a `wrong_part` return re-opens the requirement for re-sourcing; the lifecycle timeline shows every step.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## The PartRequirement spine

`part_requirements` is the spine (docs/03-data-model.md). One requirement can be satisfied by any combination of purchase-order lines, inventory withdrawals, and replacements after returns. Every satisfaction path links back to the requirement and carries `case_id` + `funding_source_id`, so case-level traceability survives even though a PO header spans many cases.

Two tables are **append-only** authoritative records (INSERT + SELECT RLS only):
- `inventory_stock_movements` — the stock ledger. `quantity_on_hand` is the running signed sum; a wrong movement is corrected by a compensating movement, never an in-place edit (proven: opening +10, withdrawal −2 → net 8).
- `part_lifecycle_events` — the human-readable timeline projection the UI consumes.

The reconciliation projection from the data model is implemented as the canonical `reconcilePartRequirement` calculation (SSoT), not a stored table.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `suppliers`, `supplier_agreements` | ✅ | master data; agreement holds discount + lead time |
| `part_requirements` (the spine) | ✅ | per case; `funding_source_id`, `estimate_part_id` back-link, `work_segment_id` |
| `purchase_orders`, `purchase_order_lines` (one PO spans many cases) | ✅ | line links a per-case requirement; `case_id`+`funding_source_id` denormalized on line for clean reconciliation |
| `part_receipts`, `part_receipt_lines` | ✅ | partial deliveries supported; advances PO line + requirement status |
| `part_returns`, `part_return_lines` | ✅ | links back to PO line; wrong/damaged/defective re-opens the requirement |
| `inventory_items`, `inventory_stock_movements`, `inventory_withdrawals` | ✅ | item balance from the append-only movement ledger; withdrawal is an alt satisfaction path |
| `part_lifecycle_events` projection (UI timeline) | ✅ | append-only; written in the same txn as each mutation |
| Parts UI on case detail | ✅ | flag part, reconciliation state per requirement, lifecycle timeline |
| Parts tagged with `funding_source_id` | ✅ | on requirements, PO lines, and withdrawals |
| Parts dashboard for purchasing coordinator | ✅ | `/parts` — open requirements across all cases |
| Reconciliation (estimated vs ordered vs received vs returned) | ✅ | `reconcilePartRequirement` SSoT calc + `reconcileCaseParts` read; 6 unit tests |
| Supplier-invoice / credit-note reconciliation (the financial close) | ⏸ Deferred (D1) | the invoiced/credited dimensions land with the finance module in Sprint 13; `funding_source_id` already on every line so it is non-breaking |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 13 new tables carry `organization_id NOT NULL`; RLS ENABLE + FORCE in `0020`. All services go through `withTransaction`; Dev reads use the platform-inspector connection. Two append-only tables have INSERT + SELECT policies only. The parts integration suite runs under the non-superuser app role; tenant isolation 8/8 still green (71/71 integration total).

### 2. RBAC compliance — PASS
- Flag/order/receive/withdraw/return all require `parts:order`; reads require `parts:view`; supplier admin requires `admin:config`. **No new permissions** — catalog stays at **24**. The existing `parts:order` description ("Create purchase orders and receive parts") already covers the flow; `parts:reconcile` is reserved for the Sprint 13 supplier-invoice reconciliation.

### 3. Audit compliance — PASS (tiered correctly)
- Requirements, POs, receipts, returns, withdrawals, suppliers, and inventory items are full-audited via `recordAuditEvent` (cancellations carry a `reason`). The stock ledger and lifecycle timeline are append-only (event-tier). New events via the transactional outbox: `parts.requirement.created`, `parts.po.created`, `parts.po.sent`, `parts.po.line_received`, `parts.inventory.withdrawn`, `parts.return.created`.

### 4. Documentation compliance — PASS
- Roadmap Sprint 11 marked complete with the D1 deferral; data-model § Parts spine annotated with implementation status; this review; 1 new metric registered (`part_reconciliation`).

### 5. Production-domain compliance — N/A (no production aggregates touched)
- Parts link to `work_segments` via a nullable FK only; no production aggregate was changed or simplified.

### 6. Dashboard compliance — PASS
- Case parts panel + `/parts` coordinator queue (User). No generic ERP dashboard. No inline arithmetic on money/percentages in presentation — all quantity aggregation feeds the SSoT reconciliation calc in the read repository; the UI only renders the resulting state. KPIs use the registry.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- **Case-level traceability is preserved** even though one PO spans many cases: every `purchase_order_lines` row links a per-case `part_requirement_id` and denormalizes `case_id` + `funding_source_id`. POs are NOT aggregated in a way that loses case traceability.
- `funding_source_id` is carried on `part_requirements`, `purchase_order_lines`, and `inventory_withdrawals` — never skipped "because there's only one funding source".
- The `part_lifecycle_events` timeline is intact and append-only (rule 4.7 explicitly forbids removing/simplifying it).
- `estimate_part_id` on the requirement back-links to the **immutable** estimate line, so estimated-vs-actual stays comparable line-for-line.
- The financial dimensions (supplier invoice / credit note) are deferred but the schema already reserves `funding_source_id` on the lines they will reconcile against — no future redesign required.

## Single Source of Truth verification — PASS
- `reconcilePartRequirement` (`src/modules/parts/application/calculations/reconciliation.ts`) is the ONE place the estimated/ordered/received/returned position is computed. The case parts panel, the `reconcileCaseParts` read, and the Dev status-rebuild repair all call it. The Dev rebuild re-derives status via the same calculation — no ad-hoc SQL.

## Three Surfaces verification — PASS
- **User:** case parts panel (flag part, per-requirement reconciliation state, lifecycle timeline) + `/parts` coordinator queue (open requirements across cases).
- **Admin:** `/admin/suppliers` (supplier master data; agreements attach lead time + discount).
- **Dev:** `/dev/parts` — cross-org requirement inspection, per-requirement lifecycle timeline, and a status-rebuild repair that re-derives status from actual quantities.

---

## Deviations / mechanics

- **D1 — Supplier-invoice / credit-note family deferred to Sprint 13 (finance).** The data-model lists `supplier_invoices`/`_lines` and `supplier_credit_notes`/`_lines`. These are the financial close (matching supplier invoices to received lines and crediting returns) and belong with the finance module + accounting export. Sprint 11 delivers the operational spine and the *quantity* reconciliation; the *financial* reconciliation is Sprint 13. `funding_source_id` is already on every line so this is additive, not a rework. Flagged, not silently dropped.
- **M1 — `part_reconciliation_status` is a calculation, not a table.** Per the SSoT rule, the reconciliation projection is the canonical `reconcilePartRequirement` function rather than a materialized table. The data-model doc has been annotated to reflect this.
- **M2 — Migration numbering.** `0019_parts_tables` (drizzle: 13 tables) + hand-authored `0020_parts_rls`. The drizzle snapshot re-emitted the `time_entries.work_segment_id` ALTER (already applied by hand in `0017`); the duplicate line was removed from `0019`.
- **M3 — `numeric(12,3)` quantities** return strings like `'2.000'`; tests compare numerically.
- **M4 — Harmless FK-name truncation NOTICE** persists on the long `work_segments` FK from Sprint 10 (unrelated to this sprint).

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 248 modules) · `check:permissions` (24) · `check:metrics` (6) · `test` (unit 43/43) · `test:integration` (**71/71**: + 7 parts-inventory, real Postgres) · `build`.

## Drift items → resolution
None. D1 is a documented sequencing into Sprint 13 (finance); M1 is an SSoT-correct choice (documented); M2–M4 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprints 10 + 11 closed (reviewed together).
