# 01 — Project Overview

## Vision

VerkstedOS becomes the operating system for collision repair workshops in Norway, then the Nordics, then Europe.

It replaces or integrates with the disjointed set of tools workshops currently use — DBS, CAB Plan, Process Manager, spreadsheets, whiteboards, time clocks, planning systems, inventory systems, and reporting systems — and provides a single, mobile-first, real-time, multi-location-aware platform for running the entire repair lifecycle.

## Scope

### In scope (MVP)

A single repair visit, from intake to delivery, fully managed:

- Customer and vehicle management
- DBS estimate import
- Multi-funding case model (insurance, private pay, deductibles, internal rework)
- Configurable production workflow
- Multi-workshop, multi-department case movement
- Resource planning and scheduling
- Mobile-first time registration
- Parts lifecycle with financial reconciliation (orders, receipts, returns, supplier invoices, credit notes)
- Image and document management
- Quality control checklists and digital signatures
- Customer communication (SMS, email, portal)
- Workshop and executive dashboards
- One accounting export integration (initially Tripletex)
- Notification engine
- Rental car management
- Yard management
- Audit log (legal/insurance grade)
- Developer Control Plane (owner-only)

### Out of MVP scope

- TakstKontroll (separate future product / module)
- AI scheduling and forecasting (foundations only)
- Bi-directional DBS sync (one-way import for MVP)
- Insurance company portal
- Multiple accounting integrations
- Native mobile apps (PWA only)
- Supplier API integrations

## Workshops we're built for

- Independent collision repair shops (1 to 30 employees)
- Body shop + paint shop combinations
- Mechanical-repair extensions to body work
- Workshop chains (2 to 50 locations under one organization)
- Calibration centers (ADAS work)

The architecture supports all of these from day one. The MVP product targets independents first because they're the fastest to onboard and value the most from replacing whiteboards.

## What we are not

- Not a general-purpose ERP. Adjacent functions (HR beyond time tracking, comprehensive payroll, full accounting) are integration points, not built-in.
- Not a marketplace, B2C app, or insurance-product platform.
- Not a CAD or design tool.

## Architectural principles

These are durable; everything else flows from them.

1. **Real workshop operations over theoretical enterprise patterns.** When in doubt, model what Norwegian collision repair actually looks like, not what an ERP textbook says.
2. **The Case is the operational root.** It is org-scoped. It moves freely across workshops and departments. It carries one timeline.
3. **Multi-tenancy is non-negotiable.** Every line of code assumes tenant context; every table is RLS-protected; every test verifies isolation.
4. **Mobile-first for the workshop floor, desktop-first for the office.** The technician with dirty hands and a phone must always be a first-class user.
5. **Modular monolith, never microservices in MVP.** Boundaries are enforced in code and folder structure. Extraction is possible later when justified by load or team size.
6. **Single Source of Truth.** Every calculation has one authoritative owner. No KPI is computed in two places.
7. **Events over orchestrators.** Cross-module side effects flow through domain events and the outbox pattern. Modules don't reach into each other's tables.
8. **Audit completeness is mandatory.** Financial-grade traceability is the baseline; nothing financial happens without an audit trail.
9. **The Dev Control Plane is a first-class system.** As soon as a class of incident requires direct database access, it becomes a Dev Control Plane tool.
10. **Configurability over assumption.** Workflows, KPIs, roles, notifications, and feature flags are data — not hardcoded behavior.
11. **Defense in depth on isolation.** Service-layer permission checks, plus RLS at the database. Either alone is not enough.
12. **Permission discipline.** Before introducing a new permission, evaluate whether an existing one solves the problem. Expand by splitting, not by layering.

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend framework | Next.js 16+ with App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |
| Server | Next.js Server Actions + Route Handlers |
| Database | Supabase PostgreSQL (single shared instance, single `public` schema) |
| ORM | Drizzle |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Jobs / events | Inngest |
| Monitoring | Sentry, Vercel Analytics |
| Logs | Supabase logs → Logflare or Axiom (year 1) |
| Hosting region | EU (Stockholm or Frankfurt — confirmed |
| External integrations | DBS, 1881, Vegvesen, SMS gateway, email, Tripletex |

## What we're replacing

| Tool | What it does | Our replacement |
|---|---|---|
| DBS | Estimating | Integration (import now, two-way later) |
| CAB Plan / Process Manager | Production planning | Native production module |
| Excel | Planning, KPI, reporting | Native planning + dashboards |
| Whiteboards | Visual production board | Native workshop dashboard + Realtime |
| Time clocks | Time registration | Native mobile-first time module |
| Internal planning systems | Resource scheduling | Native planning module |
| Inventory systems | Parts tracking | Native parts module |
| Reporting systems | BI | Native dashboards + reporting |
| Tripletex / PowerOffice / Visma | Accounting | Integration (initially Tripletex) |

## Success criteria for MVP

A single Norwegian collision repair workshop with 8-20 employees can:

1. Receive a vehicle and create a case in under 2 minutes
2. Import a DBS estimate and have a production order ready in under 5 minutes
3. Plan a week of work on a drag-and-drop calendar
4. Clock in/out from a phone in the workshop with one tap
5. Track parts from order to receipt to invoice reconciliation
6. Move a case to a sister workshop without losing history
7. See workshop status on a single dashboard with red/yellow/green health
8. Generate accounting export to Tripletex with one click
9. Send the customer SMS updates without operator effort
10. Run the entire month without touching Excel

At chain scale (post-MVP), the executive can see combined production, capacity, and KPIs across all workshops on a single screen.

## Market context

- Norway: roughly 1,200-1,500 collision repair workshops; concentration in 5-6 chains plus a long tail of independents
- DBS dominance: ~80% of insurance-claim estimating goes through DBS
- Insurer landscape: Gjensidige, If, Fremtind, Tryg dominate the claim-payer side
- Regulatory: Bokføringsloven (bookkeeping act) requires 7-10 year retention on financial records; GDPR for personal data; insurance industry expectations for traceability

## Team assumptions

- Small founding engineering team (2-5 engineers initial)
- AI-assisted development as a first-class workflow
- Founder-led product direction with deep Norwegian collision repair domain expertise
- 12-month runway to first paying customer in production
- 18-24 month runway to chain-scale customers
