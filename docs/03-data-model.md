# 03 — Data Model

This document defines the database architecture, the complete entity inventory, the funding-source model (the most distinctive part of VerkstedOS's domain), and the ERD spine.

## Database conventions

### Naming
- Tables: `snake_case_plural`, prefixed by bounded context where helpful (`case_assignments`, `production_orders`, `part_requirements`)
- Columns: `snake_case`
- Primary keys: `uuid`, generated server-side with `gen_random_uuid()`
- Foreign keys: `<entity>_id` (e.g. `case_id`, `customer_id`)
- Timestamps: `created_at`, `updated_at`, `deleted_at` (`timestamptz`)

### Types
- IDs: `uuid`
- Money: `numeric(14,2)` + paired `currency` column (NOK default)
- Enums: PostgreSQL native enums declared centrally in `db/enums.ts`
- Free text large: `text`
- Free text short: `varchar(N)` only when there's a hard business constraint
- Structured optional data: `jsonb`

### Tenant scope (mandatory columns on tenant-scoped tables)
- `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`
- `workshop_id uuid REFERENCES workshops(id)` where applicable
- `created_at`, `updated_at`, optional `deleted_at`

### Indexes
- Every FK column gets an index (Postgres does not auto-create)
- Multi-column indexes always lead with `organization_id`
- Partial indexes `WHERE deleted_at IS NULL` on active-row hot paths
- Time-series tables partitioned by month (audit, time_entries when high-volume)

### Soft delete policy
- Master data (customers, vehicles, suppliers, employees): soft delete with `deleted_at`
- Operational records mid-lifecycle (cases, POs, work segments): soft delete with reason
- Configuration (workflow defs, checklist templates): versioned, never deleted (`is_active = false`)
- Append-only (audit, time entries, immutable snapshots, state history): **never deleted** — corrections are new rows
- User identity: soft delete + GDPR anonymization preserves referential integrity

### Currency
Every monetary column has a paired `currency` column. Business logic enforces NOK-only for MVP, but the column exists so multi-currency expansion does not require a migration.

## Entity inventory

Notation: **Tenant** = `platform` (no tenant), `org`, `workshop` (also has `workshop_id`), `case` (also has `case_id`). **Audit tier**: see [02-system-architecture.md](./02-system-architecture.md).

### Identity & Access

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| Organization | Organization (root) | — | platform | full |
| Workshop | Organization | Organization | org | full |
| Department (`workshop_departments`) | Organization | Workshop | workshop | full |
| User | User (global) | — | platform | full |
| Membership | Organization | Org + User | org | full |
| Role | Organization | Organization | org | full |
| Permission (catalog) | Permission | — | platform | none |
| RolePermission | Organization | Role | org | full |
| RoleAssignment | Organization | Membership | org (+ optional workshop/dept) | full |
| UserPermissionGrant | Organization | Membership | org (+ optional scope) | full |
| OrgFeatureFlag | Organization | Organization | org | light |
| AuditEvent | (the log) | (polymorphic) | org | — |

### Customer & Case

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| Customer | Customer | Organization | org | full |
| CustomerContact | Customer | Customer | org | full |
| Vehicle | Vehicle | Organization | org | full |
| VegvesenLookup | (cache) | Organization | org | none |
| PhoneLookup1881 | (cache) | Organization | org | none |
| Case | **Case (root)** | Organization | org | full |
| CaseFundingSource | Case | Case | org+case | full |
| InsuranceClaim | InsuranceClaim | Organization | org | full |
| InsuranceCompany | platform catalog | — | platform | full |
| OrganizationInsuranceOverlay | Organization | Organization | org | full |
| CaseParty | Case | Case | org+case | full |
| CaseNote | Case | Case | org+case | full |
| Communication | Case | Case | org+case | event |
| CustomerPortalToken | Case | Case | org+case | full |

### Estimating

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| EstimateImport | EstimateImport | Case | org+case | event |
| EstimateDocument | EstimateImport | EstimateImport | org+case | immutable |
| EstimateOperation | EstimateImport | EstimateDocument | org+case | immutable |
| EstimateLaborLine | EstimateImport | EstimateDocument | org+case | immutable |
| EstimatePaintLine | EstimateImport | EstimateDocument | org+case | immutable |
| EstimatePart | EstimateImport | EstimateDocument | org+case | immutable |
| EstimateTotals | EstimateImport | EstimateDocument | org+case | immutable |
| IntegrationInbox | — | Organization | org | event |

### Production

> **The operational reasoning, workflow design, capacity engine, delivery forecasting, bottleneck detection, multi-location mechanics, and sequence diagrams for the production domain live in [10-production-domain.md](./10-production-domain.md).** The table below is the entity inventory only — refer to document 10 for the why and the how.

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| WorkflowDefinition | WorkflowDefinition | Organization | org | full |
| WorkflowState | WorkflowDefinition | WorkflowDefinition | org | full |
| WorkflowTransition | WorkflowDefinition | WorkflowDefinition | org | full |
| ProductionOrder | Case | Case | org+case | full |
| ProductionStateHistory | Case | ProductionOrder | org+case | event |
| CaseAssignment | Case | Case | org+case+workshop | full |
| CaseTransfer | Case | Case | org+case | full |
| WorkSegment | Case | ProductionOrder | org+case+workshop | full |
| Task | Case | WorkSegment | org+case+workshop | full |
| ResourceCapacity | Workshop | Department + Employee | org+workshop | light |
| YardLayout | Workshop | Workshop | org+workshop | full |
| YardLocation | Workshop | YardLayout | org+workshop | full |
| VehiclePlacement | Case | Case | org+case+workshop | full |
| VehicleMovement | Case | Case | org+case+workshop | event |

### Workforce

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| Employee | Employee | Organization | org+workshop | full |
| EmployeeSkill | Employee | Employee | org | light |
| ShiftDefinition | Workshop | Workshop | org+workshop | full |
| TimeEntry | Employee | Employee | org+workshop+(case?) | event (original) / full (corrections) |
| ClockSession | Employee | Employee | org+workshop | event |
| AbsenceType | Organization | Organization | org | full |
| AbsenceEntry | Employee | Employee | org+workshop | full |

### Parts & Procurement

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| Supplier | Organization | Organization | org | full |
| SupplierAgreement | Organization | Supplier | org | full |
| **PartRequirement** | Case | Case | org+case | full |
| PurchaseOrder | Organization | Organization | org | full |
| PurchaseOrderLine | Case | PurchaseOrder + PartRequirement | org+case | full |
| PartReceipt | Organization | PurchaseOrder | org | full |
| PartReceiptLine | Case | PartReceipt | org+case | full |
| PartReturn | Organization | Supplier | org | full |
| PartReturnLine | Case | PartReturn | org+case | full |
| SupplierInvoice | Organization | Supplier | org | full |
| SupplierInvoiceLine | Case | SupplierInvoice + PurchaseOrderLine | org+case | full |
| SupplierCreditNote | Organization | Supplier | org | full |
| SupplierCreditNoteLine | Case | SupplierCreditNote + SupplierInvoiceLine | org+case | full |
| InventoryItem | Organization | Organization | org+workshop | full |
| InventoryStockMovement | Organization | InventoryItem | org+workshop | event |
| InventoryWithdrawal | Case | PartRequirement + InventoryItem | org+case+workshop | full |
| PartLifecycleEvent | Case | PartRequirement | org+case | event |
| PartReconciliationStatus | (projection) | PartRequirement | org+case | none |

### Quality

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| ChecklistTemplate | Organization | Organization | org | full |
| ChecklistTemplateItem | Organization | ChecklistTemplate | org | full |
| ChecklistRun | Case | Case | org+case | full |
| ChecklistResponse | Case | ChecklistRun | org+case | full |
| QualityDeviation | Case | Case | org+case+workshop | full |
| DigitalSignature | Case | various | org+case | full + crypto chain |

### Documents (cross-cutting)

See [04-document-architecture.md](./04-document-architecture.md). Tables: `documents`, `document_links`, `document_access_events`.

### Finance

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| InvoiceBasis | Case | Case | org+case | full |
| InvoiceBasisLine | Case | InvoiceBasis | org+case | full |
| InternalCostRecord | Case | Case | org+case | full |
| AccountingExport | Organization | Organization | org | full |
| AccountingExportLine | Case | AccountingExport + InvoiceBasis | org+case | full |
| RentalVehicle | Organization | Workshop | org+workshop | full |
| RentalReservation | Organization | RentalVehicle | org+(case?) | full |
| RentalAgreement | Organization | RentalReservation | org+(case?) | full + signature |
| RentalReturn | Organization | RentalAgreement | org+workshop | full |

### Insight Platform

| Entity | Aggregate | Parent | Tenant | Audit |
|---|---|---|---|---|
| NotificationRule | Organization | Organization | org | full |
| Notification | Organization | (polymorphic) | org | event |
| NotificationDelivery | Organization | Notification | org | event |
| NotificationPreference | User | Membership | org | full |
| KpiDefinition | Organization | Organization | org | full |
| KpiSnapshot | (projection) | KpiDefinition | org+workshop | none |
| ReportDefinition | Organization | Organization | org | full |
| DashboardConfig | Organization | Organization | org | full |
| AiPrediction | (projection) | (polymorphic) | org | event |
| AiModelVersion | platform | — | platform | full |

### Platform / Developer Control Plane

See [06-developer-control-plane.md](./06-developer-control-plane.md). Tables: `platform_users`, `platform_role_assignments`, `platform_permissions`, `platform_role_permissions`, `platform_audit_events`, `platform_impersonation_sessions`, `platform_emergency_actions`.

## Domain model deep-dives

### Customer model (unified table with discriminator)

```
customers
 ├── id (uuid PK)
 ├── organization_id (org-scoped uniqueness)
 ├── kind ('individual' | 'company' | 'leasing_company' | 'fleet_operator')
 ├── name
 ├── identifier (personnummer for individual, orgnr for company)
 ├── identifier_kind ('personal_id_no' | 'org_no_no' | 'foreign_id')
 ├── billing_address (jsonb)
 ├── primary_email
 ├── primary_phone
 ├── notes
 ├── created/updated/deleted timestamps + actors
 └── (no workshop_id — customers are org-scoped)
```

Insurance companies are **not** customers — they are a platform-shared catalog (`platform.insurance_companies`) with an org-level overlay (`organization_insurance_overlays`) for commission rates, contact persons, and account references.

### Vehicle model (separate owner and user)

```
vehicles
 ├── id (uuid PK)
 ├── organization_id
 ├── registration_number  (license plate, indexed for search)
 ├── vin
 ├── make / model / year / colour / etc.
 ├── owner_customer_id    (FK customers, nullable — LEGAL owner: e.g. DNB Leasing)
 ├── user_customer_id     (FK customers, nullable — primary USER: e.g. Ola Hansen)
 ├── ownership_type       ('private' | 'leased' | 'company_pool' | 'rental' | 'unknown')
 ├── lease_contract_ref   (optional free text)
 └── audit fields
```

Scenarios this supports:
- **Private**: owner = user = Ola Hansen
- **Leasing**: owner = DNB Leasing (kind=leasing_company), user = Ola Hansen (kind=individual)
- **Company**: owner = LeasePlan, user = Company AS

### Case model (the operational root)

```
cases
 ├── id (uuid PK)
 ├── organization_id
 ├── case_number             (unique per org)
 ├── vehicle_id              (FK vehicles)
 ├── primary_customer_id     (who brought it in / main contact)
 ├── incident_tag            (free text, optional, indexed — covers DamageEvent gap)
 ├── current_workshop_id     (denormalized — derived from active CaseAssignment)
 ├── current_department_id   (denormalized)
 ├── status                  (workflow state — refs WorkflowState)
 ├── opened_at
 ├── delivered_at
 ├── closed_at
 ├── parent_case_id          (FK cases — for warranty rework cases)
 └── audit fields
```

### Funding Source model

This is the most distinctive part of VerkstedOS. It supports multiple insurance claims, multiple payers, deductibles, private-pay work, and internal rework — all in one repair visit.

```
case_funding_sources
 ├── id (uuid PK)
 ├── organization_id
 ├── case_id (FK cases)
 ├── sequence_no             (stable ordering)
 ├── kind                    ('insurance' | 'private_pay' | 'warranty' | 'goodwill' | 'internal_rework')
 ├── label                   ('Front damage – Fremtind', 'Bumper – customer pays', ...)
 ├── insurance_claim_id      (FK insurance_claims, when kind='insurance')
 ├── payer_customer_id       (FK customers, nullable — who gets the invoice)
 ├── payer_insurance_id      (FK platform.insurance_companies, when insurer pays direct)
 ├── deductible_amount + currency
 ├── deductible_payer_customer_id  (FK customers, when deductible exists)
 ├── coverage_cap_amount + currency
 ├── status                  ('draft' | 'active' | 'invoiced' | 'settled' | 'cancelled')
 ├── references_case_id      (FK cases, for warranty/rework references)
 ├── rework_reason           (text, required when kind='internal_rework')
 ├── rework_owner_workshop_id (FK workshops, which workshop absorbs cost)
 ├── notes
 └── audit fields
```

#### Funding source kinds

| Kind | Payer | Generates invoice? | Special behavior |
|---|---|---|---|
| `insurance` | Insurance company | Yes — to insurer + optional deductible invoice to customer | Linked to InsuranceClaim |
| `private_pay` | Customer | Yes — to customer | — |
| `warranty` | Manufacturer | Yes — to manufacturer | Rare; links back via `references_case_id` |
| `goodwill` | Workshop (absorbs) | No external invoice; InternalCostRecord generated | Workshop chooses to absorb |
| `internal_rework` | Workshop (absorbs) | No external invoice; InternalCostRecord generated | Auto-creates QualityDeviation; counts in rework rate KPI; `references_case_id` required |

#### Billable line tagging

Every billable entity carries a `funding_source_id` column:

- `estimate_operations.funding_source_id`
- `estimate_labor_lines.funding_source_id`
- `estimate_paint_lines.funding_source_id`
- `estimate_parts.funding_source_id`
- `part_requirements.funding_source_id`
- `work_segments.default_funding_source_id`
- `time_entries.funding_source_id` (when billable)
- `inventory_withdrawals.funding_source_id`

Nullable while estimating, required when the estimate is locked or the line is invoiced.

#### Invoice basis generation

For each FundingSource where `status = 'active'`:
1. Build one `InvoiceBasis` with all billable lines tagged to it
2. Subtract deductible if `kind = 'insurance'` AND `deductible_amount > 0`
3. Address to `payer_customer_id` or `payer_insurance_id`
4. If a deductible exists, create an additional InvoiceBasis to the `deductible_payer_customer_id`
5. For `kind = 'internal_rework'` or `goodwill`, create an `InternalCostRecord` instead

#### Profitability

A canonical `case_financials` calculation (single source of truth) rolls up:
- Revenue per funding source
- Costs per funding source (labor at cost rate + parts at cost + materials)
- Margin per funding source
- Margin per case
- Margin per insurer (across cases)
- Margin per customer (lifetime)
- Rework cost per workshop / per technician / per period

### Multi-location case flow

The case stays single. Workshop assignments are temporal and can repeat.

```
case_assignments
 ├── id (uuid PK)
 ├── organization_id
 ├── case_id
 ├── workshop_id
 ├── department_id (nullable)
 ├── role          ('body' | 'paint' | 'mechanical' | 'calibration' | 'assembly' | 'qc' | 'storage' | custom)
 ├── sequence_no   (order of assignments over case lifetime)
 ├── started_at
 ├── ended_at
 ├── notes
 └── audit fields

case_transfers
 ├── id (uuid PK)
 ├── organization_id
 ├── case_id
 ├── from_workshop_id
 ├── to_workshop_id
 ├── reason
 ├── transport_mode
 ├── initiated_by_user_id
 ├── initiated_at
 ├── expected_arrival_at
 ├── arrived_at (nullable)
 └── audit fields
```

All operational records (work segments, time entries, images, etc.) carry the `workshop_id` where they were created — immutably. When a case returns to a prior workshop, new records get the current workshop_id; old records keep theirs. The case timeline shows the full multi-workshop history.

### Parts & Procurement spine

**PartRequirement** is the spine. A single PartRequirement can be satisfied by any combination of POs, inventory withdrawals, and replacements after returns. One supplier invoice can carry lines for multiple cases.

```
part_requirements (one per "needed part" on a case)
   ↓ ↑ (satisfied by)
purchase_order_lines  ◄──  purchase_orders (header) ──► suppliers
   ↓
part_receipt_lines     ◄──  part_receipts
   ↓                    
supplier_invoice_lines ◄──  supplier_invoices (one invoice → many cases possible)
   ↓
supplier_credit_note_lines ◄── supplier_credit_notes (links back to invoice line)

part_returns ──► part_return_lines (link back to PO line)

inventory_withdrawals (alternative satisfaction path from stock)

part_lifecycle_events (timeline projection — UI consumes this)
part_reconciliation_status (projection — estimated vs ordered vs received vs invoiced)
```

The reconciliation projection answers: for this PartRequirement, what was estimated, what did we order, what arrived, what came back, what got invoiced, what was credited — and is the net financial position closed?

## ERD spine (case at the center)

```
                              Organization
                                   │
                                   ▼
                               Workshop
                                   │
                                   ▼
                              Department
                                          
                            Customer ──────┐
                                 │         │
                                 ▼         │
                              Vehicle      │
                                 │         │
                                 ▼         ▼
   ┌─────────────────────────  CASE  ─────────────────────────┐
   │                            ▲                              │
   │                            │                              │
   │                  CaseAssignment (1..n)                    │
   │            ─ workshop_id, department_id, role             │
   │            ─ started_at, ended_at, sequence_no            │
   │                                                            │
   │                            │                              │
   ▼                            ▼                              ▼
CaseFundingSource[]      ProductionOrder                  InvoiceBasis (per funding source)
   │                            │                              │
   ▼                            ▼                              ▼
InsuranceClaim         WorkSegment ──► TimeEntry        InvoiceBasisLine
                                │
                                ▼
                       ProductionStateHistory

   │                                                            │
   ▼                                                            ▼
EstimateImport (versioned, immutable when locked)
   │
   ▼
EstimateDocument → operations / labor / paint / parts (all tagged with funding_source_id)

   │
   ▼
PartRequirement ──► PurchaseOrderLine ──► SupplierInvoiceLine
       │                  │                      ▲
       │                  ▼                      │
       │           PartReceiptLine               │
       │                  │                      │
       ▼                  ▼                      │
InventoryWithdrawal  PartReturnLine ─── SupplierCreditNoteLine
       │
       ▼
PartLifecycleEvent (timeline projection)

   │
   ▼
Documents (via document_links polymorphic)  •  ChecklistRun  •  Communication
QualityDeviation  •  VehiclePlacement
```

## RLS strategy

Two principles:
1. RLS is defense-in-depth, not the primary authz layer.
2. Policies stay simple — three patterns cover ~95% of tables.

### Patterns

| Pattern | Used when | Policy shape |
|---|---|---|
| **Org-scoped** | Most tables | `USING (organization_id = current_setting('app.current_org_id')::uuid)` |
| **Org + workshop scoped** | Workshop-local tables (yard, shifts) | Adds `AND workshop_id = ANY(app.current_user_workshop_ids())` |
| **Append-only** | Audit, communications, immutable snapshots | INSERT policy only; UPDATE/DELETE denied |

### Helper functions (in identity schema)

- `app.current_org_id()` — reads session var
- `app.current_user_workshop_ids()` — workshops accessible to current user
- `app.has_permission(perm text)` — consults effective_permissions_cache

### Performance rules

- All multi-column indexes lead with `organization_id`
- Functions in policies are `STABLE` and called via SELECT, not `=`
- No correlated subqueries in policies
- `effective_permissions_cache` denormalized, refreshed via triggers when role assignments change

### Tables that bypass RLS

Only via `SECURITY DEFINER` functions:
- Audit writer (must write any tenant's audit row transactionally with mutation)
- Integration inbox writer (runs before org context is known)
- Platform Control Plane queries (with explicit `is_platform_inspector` flag — see [06](./06-developer-control-plane.md))

## Audit strategy (tiered)

| Tier | Storage | Used for |
|---|---|---|
| **Full** | `audit_events` row with before/after JSONB + actor + reason | Cases, claims, estimates (corrections), invoices, financial documents, role/permission changes, customers (PII), workflow definitions, digital signatures |
| **Event** | The row itself IS the audit (append-only); no separate audit entry | Production state history, case assignments, transfers, vehicle movements, communications, original time entries, part lifecycle events, notification deliveries, inventory movements, the audit_events table itself |
| **Light** | Table-level `created_by`, `created_at`, `updated_by`, `updated_at` only — no diffs | Checklist templates, KPI defs, notification rules, image categories, absence types, shift definitions, feature flags, supplier agreements, user preferences |
| **None** | No audit | Caches, computed projections, integration inbox raw payloads |

### Audit table structure

```
audit_events  (partitioned by month on occurred_at)
 ├── id (uuid)
 ├── occurred_at (timestamptz)
 ├── organization_id (uuid)
 ├── workshop_id (uuid, nullable)
 ├── actor_user_id (uuid, nullable)
 ├── actor_kind ('user' | 'system' | 'integration' | 'job' | 'platform' | 'platform_impersonation')
 ├── impersonated_user_id (uuid, nullable — set when actor_kind='platform_impersonation')
 ├── entity_table (text)
 ├── entity_id (uuid)
 ├── action (text — 'created', 'updated', 'transitioned', 'transferred', ...)
 ├── before (jsonb, nullable)
 ├── after (jsonb, nullable)
 ├── reason (text, nullable — required for transitions/deletions)
 ├── metadata (jsonb)
 ├── correlation_id (uuid)
 ├── caused_by_event_id (uuid, nullable)
```

### Write enforcement

Full-audit tables go through a mandatory **repository wrapper**:
1. Load existing row
2. Apply mutation
3. Diff old vs new
4. Insert audit_event in same transaction
5. Require `reason` field for transitions/deletions (TypeScript compile-time enforced)

Light-audit tables use Drizzle middleware that auto-populates `updated_by` from the request context.

### Retention

- Audit partitions archived after 24 months to cold storage
- Hard-deleted after 10 years (Bokføringsloven max + buffer)
- Maintenance via privileged migration role, not the app

## Drizzle schema design approach

### File layout
```
src/db/
├── schemas/
│   ├── identity/            (one file per table; barrel index.ts)
│   ├── case/
│   ├── production/
│   ├── parts/
│   ├── ...
├── relations.ts             # all relations() centralized
├── enums.ts                 # all PG enums
├── types.ts                 # inferred types
└── client.ts                # tenant-aware Drizzle client factory
```

### Conventions
- One table per file
- Server-side UUID generation
- Standardized timestamp columns
- Money as `numeric(14,2)` + paired `currency`
- All enums as PG enums declared centrally
- Foreign keys explicit with deliberate `onDelete` action
- `relations()` separated from table definitions

### Tenant-aware client
Service code never sees a raw Drizzle client. The wrapped client:
- Runs `SET LOCAL app.current_org_id` etc. at transaction start
- Refuses queries without org context (except for platform-mode calls with explicit `as: 'platform-inspector'` flag)

### Migrations
- Drizzle Kit generates; reviewed by hand
- Forward-only in production; rollback via compensating migration
- RLS policies in dedicated `.sql` files alongside Drizzle migrations
- Multi-schema config when TakstKontroll arrives later

## Indexing strategy (key indexes)

### High-traffic operational

| Query | Index |
|---|---|
| Open cases by workshop | `cases (organization_id, current_workshop_id, status) WHERE deleted_at IS NULL` |
| Production board today | `work_segments (organization_id, workshop_id, scheduled_start) WHERE status IN ('scheduled','in_progress')` |
| Employee time entries this week | `time_entries (organization_id, employee_id, started_at DESC)` |
| Open clock session | `clock_sessions (employee_id) WHERE ended_at IS NULL` — partial unique |
| Open part requirements for case | `part_requirements (case_id, status)` |
| Supplier invoice lines for case | `supplier_invoice_lines (organization_id, case_id, status)` |
| Yard view at workshop | `vehicle_placements (organization_id, workshop_id) WHERE released_at IS NULL` |

### Search

| Query | Index |
|---|---|
| Vehicle by reg | `vehicles (organization_id, registration_number)` + trigram |
| Customer by phone | `customer_contacts (organization_id, phone_normalized)` |
| Case by case_number / claim_number | `cases (organization_id, case_number)` + `(organization_id, claim_number)` |
| Case full-text search | `tsvector` generated column + GIN |

### Multi-tenant rules
- Every multi-column index leads with `organization_id`
- No global unique constraints on tenant-scoped tables — always `(organization_id, business_key)`
- Partial indexes `WHERE deleted_at IS NULL` for hot active-row paths
- JSONB GIN indexes added only when justified by measured queries
