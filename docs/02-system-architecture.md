# 02 — System Architecture

## Architectural style

VerkstedOS is a **Modular Monolith on Next.js** with a **shared multi-tenant PostgreSQL database**, complemented by an **event bus for asynchronous cross-module communication** and **clearly defined bounded contexts**.

### Why this style

- **Transactional cohesion**: a single case touches customers, vehicles, DBS, planning, time, parts, images, audit. Distributed transactions across microservices would be slow and brittle.
- **Bounded-context separation**: the domain has clear seams (production vs estimating vs parts vs finance) that we enforce in code now and can extract later when justified.
- **PaaS-first stack**: Vercel + Supabase favors a single deployable unit; microservices on Vercel is an anti-pattern.
- **Small team**: a modular monolith is the right size for a 2-5 engineer team building a complex domain.

### Rejected alternatives (with reasons)

- **Microservices from day one** — premature; high ops cost; would slow MVP delivery significantly
- **Database-per-tenant** — operationally expensive at the 50-500 organization scale; Supabase not optimized for it
- **Pure CRUD with no events** — cross-module side effects would leak through the codebase within months

## Bounded contexts

The product modules collapse into 10 bounded contexts. Modules inside the same context share data freely; cross-context communication flows through service ports and events.

| # | Bounded context | Owns |
|---|---|---|
| BC-1 | **Identity & Access** | Organizations, workshops, departments, users, memberships, roles, permissions, audit |
| BC-2 | **Customer & Case** | Customers, vehicles, cases, claims, case parties, funding sources |
| BC-3 | **Estimating & Integration** | Estimate imports, estimate documents, DBS integration, Vegvesen/1881 lookups |
| BC-4 | **Production** | Production orders, workflow, case assignments, transfers, work segments, yard — [deep dive in 10-production-domain.md](./10-production-domain.md) |
| BC-5 | **Workforce** | Employees, time entries, clock sessions, absences, resource capacity |
| BC-6 | **Parts & Procurement** | Part requirements, POs, receipts, returns, supplier invoices, credit notes, inventory |
| BC-7 | **Quality & Documentation** | Checklists, deviations, digital signatures (the **Documents** module is cross-cutting — see [04-document-architecture.md](./04-document-architecture.md)) |
| BC-8 | **Financial Control** | Invoice basis, accounting exports, rental |
| BC-9 | **Communication & Portal** | SMS, email, customer portal |
| BC-10 | **Insight Platform** | Notifications, KPIs, reports, dashboards, AI foundation |

Plus a cross-cutting **Documents** module and a separate **Developer Control Plane** (see [06-developer-control-plane.md](./06-developer-control-plane.md)).

## Container view

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Vercel Edge / CDN                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌──────────────┐         ┌───────────────────┐     ┌──────────────────┐
│ Next.js App  │         │ Next.js Route     │     │ Customer Portal  │
│ (RSC + UI)   │         │ Handlers          │     │ (route group)    │
│ Server       │         │ - Webhooks        │     └──────────────────┘
│ Actions      │         │ - REST API        │
│              │         │ - Integrations    │     ┌──────────────────┐
└──────┬───────┘         └─────────┬─────────┘     │ /dev — Control   │
       │                           │               │ Plane            │
       └─────────────┬─────────────┘               │ (hardened MW)    │
                     ▼                             └────────┬─────────┘
         ┌───────────────────────┐                          │
         │  Service Layer        │ ◄────────────────────────┘
         │  (per bounded ctx)    │
         │  - Domain services    │
         │  - Policies (RBAC)    │
         │  - Calculations       │
         │  - Tx orchestration   │
         └─────────┬─────────────┘
                   │
        ┌──────────┼──────────┬──────────────┬────────────┐
        ▼          ▼          ▼              ▼            ▼
┌────────────┐ ┌────────┐ ┌─────────┐  ┌──────────┐  ┌──────────┐
│ Drizzle    │ │ Outbox │ │ Inngest │  │ Supabase │  │ External │
│ + Postgres │ │ (Pg    │ │ (jobs + │  │ Storage  │  │ Adapters │
│ (Supabase) │ │ table) │ │  events)│  │          │  │          │
│ + RLS      │ └────────┘ └─────────┘  └──────────┘  └──────────┘
└────────────┘     │           │
                   └───────────┘
                       │
                       ▼
         ┌───────────────────────┐
         │ Supabase Realtime     │
         │ (UI broadcast)        │
         └───────────────────────┘
```

## Layered architecture (inside each module)

```
src/modules/<context>/
├── domain/          # Pure types, value objects, invariants. No I/O.
├── application/
│   ├── services/    # Use-case orchestration
│   ├── policies/    # Permission and business rule checks
│   ├── calculations/# Single Source of Truth — pure functions
│   └── ports/       # Interfaces this module needs from others
├── infrastructure/
│   ├── repositories/# Drizzle implementations
│   ├── adapters/    # External system clients
│   └── projections/ # Read-model rebuilders
├── presentation/
│   ├── actions/     # Next.js server actions
│   ├── api/         # Route handlers
│   └── ui/          # RSC components, hooks, client components
├── public/          # Exported types, ports, events for OTHER modules
└── index.ts         # Barrel — only re-exports from public/
```

### Rules (enforced via lint + dependency-cruiser)

- `presentation` may only call `application`
- `application` may call `domain`, its own `infrastructure`, and `ports` of other contexts
- `infrastructure` may not call `presentation` or another module's internals
- Cross-context calls go through `public/` exports — never deep imports
- Raw SQL forbidden in service code (lint rule)

## Module ownership map

| Module | Table prefix | Exposes |
|---|---|---|
| `identity` | `identity_*`, `org_*`, `role_*`, `permission_*`, `membership_*` | UserContext, has_permission, org/workshop lookup |
| `audit` | `audit_*` | recordAuditEvent() service |
| `customer` | `customer_*`, `vehicle_*`, `phone_lookups_*`, `vegvesen_*` | CustomerRef, VehicleRef ports |
| `claim` | `insurance_claim_*` | ClaimRef port |
| `case` | `case_*`, `case_funding_*`, `case_assignment_*`, `case_transfer_*` | CaseRef port, Case events |
| `estimating` | `estimate_*`, `integration_inbox` | EstimateRef, EstimateVersionRef |
| `production` | `production_*`, `work_segment_*`, `workflow_*`, `yard_*`, `vehicle_movement_*` | ProductionOrderRef, current state |
| `workforce` | `employee_*`, `time_*`, `clock_*`, `absence_*`, `resource_capacity_*` | TimeRollup port |
| `parts` | `part_*`, `purchase_*`, `supplier_invoice_*`, `supplier_credit_note_*`, `inventory_*`, `supplier_*` | PartReconciliationRef |
| `quality` | `checklist_*`, `quality_deviation_*`, `digital_signature_*` | ChecklistRef |
| `documents` | `documents`, `document_links`, `document_access_events` | DocumentPort |
| `finance` | `invoice_basis_*`, `accounting_export_*`, `rental_*`, `internal_cost_records` | InvoiceRef |
| `communication` | `communication_*`, `customer_portal_*` | sendSms(), sendEmail() ports |
| `insight` | `notification_*`, `kpi_*`, `report_*`, `dashboard_*`, `ai_*` | (consumer; rarely exposes) |
| `platform` | `platform_*` | Platform Control Plane (see 06) |

## Inter-module communication

Three permitted channels:

| Channel | When to use | Example |
|---|---|---|
| **Direct port call (sync)** | Result needed immediately; in request critical path | Case module asking Identity "is this customer accessible?" |
| **Domain event (async)** | Side effect is downstream and should not block | EstimateImported → ProductionOrder created → Notification sent |
| **Read model query** | Module needs to display data owned by another | Dashboard reading KPI projection |

Forbidden:
- Importing another module's `infrastructure` or `domain`
- Joining across modules' tables in queries (use a view exposed in `public/`)
- Writing to another module's tables

## API architecture

### Four surfaces

| Surface | Consumer | Auth | Protocol |
|---|---|---|---|
| **Internal mutations** | Next.js UI | Supabase JWT session | Server Actions |
| **Internal reads** | RSC / client components | Same session | Direct service calls in RSC |
| **Public REST API** | Mobile (PWA), integrations | Bearer token | Route Handlers, REST + JSON |
| **Webhooks (in)** | DBS, accounting, SMS receipts | HMAC signature | Route Handlers |

### Server Actions vs Route Handlers

Use Server Actions for: form submissions, status changes, UI-tied workflows.
Use Route Handlers for: webhooks, mobile PWA fetches, file uploads, third-party integrations, exports, public reads.

Rule of thumb: if a non-Next.js client could call it, it must be a Route Handler.

### REST conventions

```
/api/v1/cases
/api/v1/cases/:id
/api/v1/cases/:id/funding-sources
/api/v1/cases/:id/assignments
/api/v1/cases/:id/state-transitions
/api/v1/cases/:id/parts
/api/v1/cases/:id/documents
/api/v1/employees/me/clock-in
/api/v1/employees/me/clock-out
/api/v1/suppliers/:id/invoices
/api/v1/integrations/dbs/import
```

- Versioned (`/v1/`) from day one
- Stable envelope: `{ data, meta, errors }`
- Cursor-based pagination only
- Idempotency-Key header supported for writes
- ISO 8601 UTC timestamps
- Money as `{ amount: string, currency: 'NOK' }` — string to preserve precision

### Authorization at the edge

Every endpoint runs through a uniform pipeline:

```
1. authenticate()           → user_id or fail 401
2. resolveContext(orgId?)   → load org, memberships, permissions
3. requirePermission(perm)  → 403 if missing
4. validateInput(schema)    → Zod; 400 if invalid
5. service.execute(ctx, input)
6. mapErrors → response
```

The pipeline is wrapped in a helper so every endpoint looks the same. No endpoint can "forget" auth.

### Webhook handling

Inbound webhooks:
1. Receive request; verify HMAC against provider's secret
2. Write raw payload to `integration_inbox` (org_id resolved from API key or payload)
3. Return 200 immediately
4. Enqueue Inngest job to process
5. Process payload, write domain entities, emit events
6. On failure, inbox row remains for replay

Outbound webhooks (for customer-side subscribers):
- Signed with HMAC-SHA256
- Retries with exponential backoff via Inngest
- Dead-letter queue surfaced in Dev Control Plane

## Event architecture

### Runtime

**Inngest** for: scheduler (cron), durable job queue, retry orchestration, event consumption.
**Postgres outbox** for: durable event production transactional with mutations.

### Outbox pattern

```
service_layer:
  BEGIN TX
    UPDATE cases SET ... WHERE id = ...
    INSERT INTO audit_events (...)
    INSERT INTO outbox_events (event_type, payload, ...)
  COMMIT TX
```

A separate Inngest cron reads `outbox_events` every 2s, ships them to Inngest, marks them published. Events are emitted only if the originating transaction commits. Consumers dedupe on `event_id`.

### Event naming

`<context>.<aggregate>.<past_tense_verb>`

```
case.case.created
case.case.transferred
case.funding_source.added
case.funding_source.status_changed
claim.claim.opened
estimate.import.locked
estimate.import.superseded
production.state.transitioned
production.work_segment.completed
workforce.time.entry_recorded
parts.po.line_received
parts.invoice.received
parts.return.created
quality.image.uploaded
quality.checklist.completed
finance.invoice_basis.generated
finance.accounting.exported
identity.role_assignment.granted
```

### Event payload contract

```json
{
  "event_id": "uuid",
  "event_type": "case.case.transferred",
  "event_version": 1,
  "occurred_at": "ISO-8601",
  "organization_id": "uuid",
  "workshop_id": "uuid | null",
  "actor": { "kind": "user|system|integration|platform", "id": "uuid" },
  "correlation_id": "uuid",
  "causation_id": "uuid | null",
  "payload": { /* typed per event_type */ }
}
```

Versioned. New fields are non-breaking; removing fields requires a new version. All types defined via Zod in a central catalog.

### Subscriber patterns

| Pattern | Examples |
|---|---|
| **Projector** | KpiProjection, ProductionBoardProjection, PartReconciliationProjection |
| **Notifier** | MissingPartsNotifier, DelayNotifier, CustomerStatusUpdateNotifier |
| **Workflow** | CaseTransferWorkflow (moves images/documents, recomputes assignments) |
| **Integration emitter** | OutboundWebhookDispatcher |
| **External integration caller** | AccountingExportTrigger, SmsGatewaySender |

### Retry and DLQ

- Default: 5 retries with exponential backoff (1s, 5s, 30s, 5min, 30min)
- After exhaustion: event lands in `failed_events` with full error context
- Dev Control Plane surfaces failed events; manual retry available

### Realtime channels (UI fanout)

Separate from the event bus. Realtime is for UI updates, not durable workflows.

```
workshop:<id>:production
workshop:<id>:yard
workshop:<id>:notifications
case:<id>
user:<id>
```

Channel access enforced by Supabase RLS on underlying tables.

## Cross-cutting concerns

### Authentication
Supabase Auth (email/password, magic link, OIDC for enterprise SSO later). JWT carries `user_id` only — tenant/role context resolved server-side per request.

### Authorization
Two layers: explicit service-layer policy checks (business-aware) + RLS in Postgres (defense-in-depth). Both required.

### Tenancy
Shared schema; every tenant-scoped table has `organization_id` (and where relevant `workshop_id`). Context propagated via AsyncLocalStorage; DB queries run with `SET LOCAL` session vars.

### Observability
- **Sentry**: errors, perf, tagged with org/workshop/user/case
- **Structured logs**: JSON to Vercel; shipped to Logflare/Axiom
- **Audit log**: domain artifact in Postgres, outbox-pattern writes
- **Vercel Analytics**: RUM

### Configuration
- Per-org feature flags table
- Per-org workflow definitions (states + transitions are data)
- Per-org KPI definitions, notification rules, role definitions

### File handling
All binary content via the documents module → Supabase Storage. Tenant-prefixed paths. Storage RLS mirrors DB RLS. See [04-document-architecture.md](./04-document-architecture.md).

### Background work
Reactive jobs triggered by events; scheduled jobs via Vercel Cron or Inngest. Anything >10s goes to the job queue, never inline.

### Internationalization
Norwegian primary, English secondary; i18n from day one. UTC storage, workshop-local rendering.

## Non-functional requirements

| Concern | Target |
|---|---|
| Tenant isolation | Zero cross-tenant data leak (verified via integration tests) |
| Mobile latency | p95 < 1.5s on 4G for core workshop screens |
| Realtime status | < 2s end-to-end for status change → other clients |
| Uptime | 99.9% for core production module |
| Audit completeness | Every state-changing action logged; never silently lost |
| Recovery | RPO ≤ 24h, RTO ≤ 4h |
| Compliance | Norwegian Bokføringsloven (7-10 year retention), GDPR |

## Architectural decision records (summary)

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Modular monolith over microservices | Accepted |
| ADR-002 | Shared-schema multi-tenancy with RLS | Accepted |
| ADR-003 | Service layer mandatory between routes/actions and Drizzle | Accepted |
| ADR-004 | DBS imports stored as immutable versioned documents | Accepted |
| ADR-005 | Outbox pattern for events + audit | Accepted |
| ADR-006 | Production workflow states are data | Accepted |
| ADR-007 | Customer portal in same Next.js app under route group | Accepted |
| ADR-008 | Inngest for job runner | Accepted |
| ADR-009 | EU region (Stockholm or Frankfurt) | Accepted |
| ADR-010 | PWA-only for MVP, no native apps | Accepted |
| ADR-011 | Single `public` schema with table prefixes | Accepted |
| ADR-012 | TakstKontroll de-scoped from MVP | Accepted |
| ADR-013 | Funding Source model over Claim-as-root | Accepted |
| ADR-014 | DamageEvent deferred; `incident_tag` covers gap | Accepted |
| ADR-015 | Single Customer table with `kind` discriminator | Accepted |
| ADR-016 | Department kept as lightweight grouping | Accepted |
| ADR-017 | Tiered audit (full / event / light / none) | Accepted |
| ADR-018 | MVP permission catalog ~24 permissions, 6 roles | Accepted |
| ADR-019 | Developer Control Plane as first-class system from day one | Accepted |
| ADR-020 | Three non-negotiable governance rules (SIA, SSOT, Dev Panel Coverage) | Accepted |
