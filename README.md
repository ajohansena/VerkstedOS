# VerkstedOS — Architecture Documentation

This documentation package describes the architecture of **VerkstedOS**, a cloud-based ERP and production management platform for collision repair, body shop, paint shop, and insurance repair workshops.

Target market: Norway initially, Nordics and EU thereafter.

---

## How to read this package

The documents are ordered by abstraction level — start at the top, drill down as needed.

| # | Document | What's in it |
|---|---|---|
| ⭐ | [CLAUDE.md](CLAUDE.md) | **Coding Master Prompt** — the governing document for all implementation work. Lives at the repo root; read automatically as project instructions. |
| 1 | [docs/01-project-overview.md](docs/01-project-overview.md) | Vision, scope, principles, tech stack, what we're replacing |
| 2 | [docs/02-system-architecture.md](docs/02-system-architecture.md) | Architectural style, bounded contexts, modules, APIs, events, runtime |
| 3 | [docs/03-data-model.md](docs/03-data-model.md) | Domain entities, funding-source model, vehicle parties, ERD spine, database conventions |
| 4 | [docs/04-document-architecture.md](docs/04-document-architecture.md) | Storage, metadata, versioning, retention, security, the documents module |
| 5 | [docs/05-multi-tenant-and-rbac.md](docs/05-multi-tenant-and-rbac.md) | Tenant hierarchy, request lifecycle, RLS strategy, permissions, roles |
| 6 | [docs/06-developer-control-plane.md](docs/06-developer-control-plane.md) | Owner-only operational cockpit: inspection, impersonation, repair, emergency ops |
| 7 | [docs/07-governance.md](docs/07-governance.md) | The three non-negotiable rules + PR template + ADR template |
| 8 | [docs/08-security-deployment-scalability.md](docs/08-security-deployment-scalability.md) | Threat model, environments, observability, scaling targets |
| 9 | [docs/09-roadmap.md](docs/09-roadmap.md) | 28-sprint comprehensive project plan: foundation → operational MVP → chain MVP → production maturity → platform expansion |
| 10 | [docs/10-production-domain.md](docs/10-production-domain.md) | **The production domain in depth** — aggregates, work segments, resources, workflow engine, capacity engine, delivery forecasting, bottleneck detection, multi-location, sequence diagrams, edge cases |
| 11 | [docs/11-dashboards.md](docs/11-dashboards.md) | **Six role-specific dashboards** — Production Manager, Painter, Body Technician, Estimator, Workshop Owner, Executive — with information architecture, actions, permissions, and drill-downs per role (the information inventory) |
| 12 | [docs/12-ux-architecture.md](docs/12-ux-architecture.md) | **Product Experience & UX Architecture** — how VerkstedOS *feels*: case-centric model, Operations Center, command palette, navigation, role experiences, dashboard strategy, mobile strategy, design principles, anti-patterns (the experiential layer) |

---

## Locked architectural decisions (reference)

These decisions are settled and should not be reopened without strong cause.

### Tech stack
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Hosting**: Vercel
- **Backend**: Next.js Server Actions + Route Handlers
- **Database**: Supabase PostgreSQL
- **ORM**: Drizzle
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime
- **Jobs / events**: Inngest
- **Monitoring**: Sentry + Vercel Analytics

(Specific framework versions are tracked in `package.json` and infrastructure-as-code, not pinned in governance. Major upgrades require an ADR — see `CLAUDE.md` § 3 Version Policy.)

### Architectural style
- Modular Monolith
- Multi-tenant SaaS with shared Postgres + RLS
- Event-driven where appropriate (outbox pattern)
- API-first

### Key model decisions
- **Case** is the operational root; org-scoped, not workshop-scoped
- **Multi-location case flow** (A → B → C → A) is a first-class capability
- **Funding Sources** per case: multiple insurance claims, deductibles, private-pay, internal rework — all on one repair visit
- **Customer** table unified with `kind` discriminator (individual / company / leasing / fleet)
- **Vehicle** has separate owner and user
- **Insurance company** is a platform-shared catalog
- **DamageEvent** deferred (not in MVP); `cases.incident_tag` covers the gap
- **Department** kept as a lightweight grouping concept
- **Single Postgres schema** (`public`) with table-name prefixes by bounded context
- **Currency** stored alongside every monetary value
- **TakstKontroll** is a future bounded context, not an MVP concern
- **Audit** is tiered (full / event / light / none) per entity class

### Non-negotiable process rules

The architectural rules (locked in `CLAUDE.md`):

1. **Architecture Freeze** — no new bounded contexts, domains, workflows, or tenancy models without project-owner approval
2. **Multi-Tenant Isolation** — RLS + service-layer authz + tenant-aware client; tenant isolation tests gate every merge
3. **RBAC Discipline** — permissions are code, roles are data, no permission proliferation
4. **Production Domain Protection** — aggregates remain as designed; no simplifications
5. **Single Source of Truth** — every calculation has one authoritative owner in the metric registry
6. **Module Boundaries** — enforced by `dependency-cruiser` in CI
7. **TakstKontroll Compatibility** — preserve future TakstKontroll integration on every estimate / invoice / parts / audit decision
8. **No Cleverness** — prefer boring, maintainable solutions; AI speed is not justification for complexity
9. **Database First** — every feature begins with the data model, never with UI

The process rules (governed at every PR):

1. **System Impact Analysis** completed for every change — see [07-governance.md](./07-governance.md)
2. **Single Source of Truth** applied to every calculation, KPI, business rule
3. **Three Surfaces** (User / Admin / Dev) defined for every feature
4. **Implementation Review Gate** at every sprint close — six-dimension compliance check before sprint can be marked complete

See [CLAUDE.md](./CLAUDE.md) for the complete governing rules.

---

## Status

**Architecture phase: COMPLETE and APPROVED.**

**Implementation phase: READY TO BEGIN.**

The architecture has been reviewed and approved through eleven iterations covering: system architecture, database architecture, domain model, multi-tenancy, RBAC, modules, APIs, events, scalability, security, deployment, the Developer Control Plane, the production domain, the dashboards module, and the implementation governance hardening.

Implementation is governed by [CLAUDE.md](./CLAUDE.md), the Coding Master Prompt. Paste `CLAUDE.md` into Claude Code, or place it at the repository root — Claude Code reads it automatically as the project's governing instructions.

See [09-roadmap.md](./09-roadmap.md) for the 28-sprint plan, starting with Sprint 1 (Project skeleton).

---

## Getting started

### For the project owner
1. Read this `README.md` (you're doing it)
2. Read `01-project-overview.md` (15 min — confirms scope and stack)
3. Read `09-roadmap.md` § Phase 1 (15 min — Sprints 1-4)
4. Authorize Sprint 1 to begin

### For a new engineer joining the team

Read in this order (~3 hours total):

1. `README.md` (5 min)
2. `01-project-overview.md` (15 min)
3. `CLAUDE.md` (45 min) — the governing rules you'll be held to
4. `02-system-architecture.md` (30 min)
5. `07-governance.md` (15 min) — PR template, ADR template
6. `10-production-domain.md` (45 min) — the heart of the platform
7. `03-data-model.md` (45 min) — keep as reference card

Everything else: read as needed.

### For Claude Code (implementation)

`CLAUDE.md` lives at the repository root and is read automatically as the project's governing instructions. The architecture docs live in [`docs/`](docs/).

---

## Running locally

**Prerequisites:** Node 22+ and pnpm 9+.

```bash
pnpm install                 # install dependencies
cp .env.example .env.local   # then fill in real values (see Provisioning below)
pnpm dev                     # start the dev server at http://localhost:3000
```

Quality gates (the same checks CI runs):

```bash
pnpm typecheck   # tsc --noEmit (strict)
pnpm lint        # eslint (incl. module-boundary rules)
pnpm depcruise   # dependency-cruiser module boundary check
pnpm test        # vitest
pnpm build       # next build
```

Database (Drizzle):

```bash
pnpm db:generate # generate SQL migrations from schema
pnpm db:migrate  # apply migrations
```

## Provisioning (project-owner actions)

Sprint 1 ships the code skeleton with placeholder environment variables. Before the
app can run end-to-end, the project owner provisions the external services and fills
`.env.local` (local) and the Vercel project env (deployed). See [`.env.example`](.env.example)
for the full list.

| Service | What to create | Env vars to capture |
|---|---|---|
| **Supabase** (EU — Stockholm/Frankfurt) | Project + database | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` |
| **Inngest** | App + keys | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| **Sentry** | Project + auth token | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| **Vercel** | Project linked to this repo, EU region, env vars set | (deploy target) |

## Deploying

Deployment is via **Vercel** (EU region). `main` deploys to production; every PR gets a
preview deployment. Environment variables are configured in the Vercel project dashboard
(never committed). See [docs/08-security-deployment-scalability.md](docs/08-security-deployment-scalability.md)
for the full deployment and CI/CD pipeline.

---

## Package contents

| File | Purpose |
|---|---|
| `CLAUDE.md` | Coding Master Prompt — governs all implementation work (repo root) |
| `README.md` | This file — repo index, quick reference, how to run |
| `docs/01-project-overview.md` | Vision, scope, principles |
| `docs/02-system-architecture.md` | Architectural style, modules, APIs, events |
| `docs/03-data-model.md` | Entity inventory, ERD, RLS, audit tiers |
| `docs/04-document-architecture.md` | Storage, metadata, versioning, retention |
| `docs/05-multi-tenant-and-rbac.md` | Tenancy, permissions, roles |
| `docs/06-developer-control-plane.md` | Owner-only operational cockpit |
| `docs/07-governance.md` | Three non-negotiable rules + templates |
| `docs/08-security-deployment-scalability.md` | Threat model, deployment, scaling |
| `docs/09-roadmap.md` | 28-sprint comprehensive project plan |
| `docs/10-production-domain.md` | Production domain in depth |
| `docs/11-dashboards.md` | Six role-specific dashboards (information inventory) |
| `docs/12-ux-architecture.md` | Product experience & UX architecture (experiential layer) |
| `docs/adrs/` | Architecture Decision Records |
| `docs/sprint-reviews/` | Sprint implementation-review documents |

---

## Glossary

| Term | Meaning |
|---|---|
| **Case** | The workshop's operational record for one repair visit of one vehicle. Org-scoped. |
| **Funding Source** | A payer for some portion of a case. Multiple per case allowed. |
| **DBS** | Damage Body Shop estimating system, dominant in Norwegian collision repair |
| **Takstkontroll** | Norwegian term for insurance estimate verification — out of MVP scope |
| **Workshop** | A physical location operated by an organization |
| **Department** | Lightweight functional grouping within a workshop (Body, Paint, etc.) |
| **Bokføringsloven** | Norwegian Bookkeeping Act — drives retention windows |
| **Vegvesen** | Norwegian Public Roads Administration — registration plate lookup source |
| **1881** | Norwegian phone directory service |
| **InvoiceBasis** | Pre-invoice record per funding source, becomes the invoice on export |
| **PartRequirement** | The spine entity linking estimate → ordering → receiving → invoicing for parts |
| **Dev Control Plane** | Owner/developer-only operational cockpit; never exposed to customers |
