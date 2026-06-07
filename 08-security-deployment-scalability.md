# 08 — Security, Deployment, and Scalability

This document covers the operational side of VerkstedOS: how it's secured, how it's deployed, and how it scales.

---

# Security

## Threat model

| Threat | Mitigation |
|---|---|
| Cross-tenant data leak | RLS + service-layer authorization + tenant-aware client + integration tests per boundary |
| Stolen session | Short JWT lifetime (1h), refresh tokens, IP/UA anomaly detection, revocation list |
| Privilege escalation | Permission checks at service layer + RLS; admin actions require step-up auth (re-enter password) for sensitive operations |
| SQL injection | Drizzle parameterized queries only; raw SQL forbidden in service code by lint rule |
| Insecure direct object reference | All entity lookups go through repository that validates org/scope before returning |
| Webhook spoofing | HMAC verification per provider; replay-protection via nonce/timestamp window |
| Data exfiltration via API key | API keys scoped, rate-limited, auditable, revocable |
| Image upload abuse | Server-side type validation, virus scan (ClamAV in storage trigger), size limits, signed upload URLs |
| Customer portal abuse | Single-case scoped tokens, rate limits, no general API access |
| Insider threat | Full audit on financial/admin actions; alert on admin role assignment changes |
| GDPR-related risks | DPA with subprocessors, data export per customer, anonymization procedure, retention enforcement |
| Platform credential theft | Mandatory 2FA on `platform_users`; IP allow-listing for `/dev`; Slack alerts on sensitive actions |

## Secrets management

- All secrets in Vercel environment variables
- No secrets in code or in DB
- Per-environment isolation (preview, staging, production)
- Rotation procedure documented; integration secrets rotatable from admin UI without redeploy
- Service-role keys never exposed to client; only used in server contexts

## Authentication baseline

- **Customer users**: Supabase Auth with email/password + magic link. OIDC for enterprise SSO post-MVP.
- **Customer API keys**: Bearer tokens scoped to org, optionally to a single integration. Stored hashed. Per-key permission bundles. Rotatable. Tied to a synthetic "integration user" so audit identifies the integration, not a human.
- **Platform users**: same Supabase Auth, additionally must have `platform_users` row + active `platform_role_assignments`. **2FA mandatory**. IP allow-listing in production.

## Authorization layers (defense in depth)

1. **Service-layer policy checks** — explicit `requirePermission(ctx, 'case:edit', { caseId, workshopId })` per use-case
2. **RLS in Postgres** — every tenant-scoped table has policies referencing `organization_id` and `app.has_permission()`
3. **Storage RLS** — Supabase Storage policies mirror DB RLS via path prefix

Either alone is insufficient. The combination ensures:
- A bug in service code can't bypass database-level isolation
- A misconfigured RLS policy can't let an unauthorized service call through

## Compliance baseline

| Requirement | Mechanism |
|---|---|
| **GDPR** | Lawful basis documented per data category; DPA template; customer data export; anonymization procedure; retention windows; right-to-erasure flow |
| **Norwegian Bokføringsloven** | 7-10 year retention on financial records (estimates, invoices, accounting exports); immutable accounting export records; audit completeness |
| **Insurance industry expectations** | Estimate immutability with versioning; full audit on every financial change; document retention 10 years |
| **ISO 27001 readiness (year 2)** | Logging, access reviews, change management procedures in place from day one; certification deferred |

## Penetration testing cadence

- **Year 1**: External pen-test before first paying customer onboards 10+ workshops
- **Annually thereafter**
- **Continuous**: Snyk for dependencies, GitHub code scanning, Sentry for runtime anomalies, quarterly access review of `platform_users`

## Data Protection Impact Assessment (DPIA)

A DPIA is completed before launch covering:
- Categories of personal data (customer contacts, vehicle ownership, signed agreements, technician records)
- Legal basis (contract, legitimate interest, consent for marketing communications)
- Subprocessors (Vercel, Supabase, Inngest, Sentry, SMS provider, email provider)
- Data flows (especially the few that cross EEA boundaries — minimized)
- Risks and mitigations

## Subprocessor list (initial)

| Subprocessor | Role | Data | Location |
|---|---|---|---|
| Vercel | Hosting | All in-memory | EU |
| Supabase | Database, Auth, Storage, Realtime | Customer data at rest | EU |
| Inngest | Background jobs | Event payloads | EU (configurable) |
| Sentry | Error monitoring | Stack traces, request context | EU |
| SMS provider (e.g. LinkMobility) | SMS delivery | Phone numbers, message text | Norway/EU |
| Email provider (e.g. Resend) | Email delivery | Email addresses, message content | EU |

Each subprocessor under a Data Processing Agreement. List published in customer-facing legal page.

## Security checklist (pre-launch)

- [ ] All tables have RLS policies
- [ ] Tenant isolation integration tests pass
- [ ] Platform Control Plane access list reviewed
- [ ] 2FA enforced on all platform users
- [ ] IP allow-list configured for `/dev`
- [ ] Pen-test completed and findings addressed
- [ ] DPIA completed and signed
- [ ] DPA executed with all subprocessors
- [ ] Privacy policy and terms of service published
- [ ] Incident response runbook documented

---

# Deployment

## Environments

| Environment | Purpose | Hosting |
|---|---|---|
| **local** | Dev | Local Postgres or Supabase CLI; Inngest dev server |
| **preview** | Per-PR | Vercel preview deployments; ephemeral Supabase branch DB |
| **staging** | Pre-production smoke | Dedicated Vercel + Supabase EU |
| **production** | Live | Vercel + Supabase EU (Stockholm or Frankfurt) |

## CI/CD pipeline (GitHub Actions)

```
on push:
  ├── lint (eslint, prettier)
  ├── typecheck (tsc)
  ├── dependency-cruiser (module boundary check)
  ├── permission catalog drift check
  ├── calculation registry coverage check
  ├── unit tests (vitest)
  ├── integration tests (vitest + testcontainers Postgres)
  ├── tenant isolation test suite (gates merge)
  ├── E2E tests (Playwright) — on main and release branches
  ├── Drizzle migration drift check
  ├── build
  └── deploy preview / staging / production via Vercel
```

### Migration strategy

- Generated by Drizzle Kit; reviewed by hand
- Forward-only in production; rollback via compensating migration
- Run automatically on deploy via Supabase migration framework
- Pre-deploy compatibility check (no breaking changes during deploy window)
- RLS policy migrations in dedicated `.sql` files alongside Drizzle migrations

### Branch and release strategy

- `main` = production-ready
- Feature branches → PR → preview deploy → merge to `main`
- Production deployments are tagged releases
- Hotfix branches allowed for emergency patches; same PR + review process

## Observability

| Channel | What it captures |
|---|---|
| **Sentry** | Errors, performance traces, release tracking; tagged with org_id/workshop_id/user_id/case_id |
| **Vercel Analytics** | Page performance, RUM |
| **Supabase logs** | DB slow queries, RLS denials, auth events → shipped to Logflare or Axiom |
| **Inngest dashboard** | Job runs, failures, retries, DLQ |
| **Internal KPIs** | Production "case throughput" instrumented as part of the product — drives executive dashboard and ops alerting |
| **Platform Control Plane health** | `/dev/health` aggregates the above for the platform team |

### Alert routing

- Critical (production down, tenant isolation failure detected, DB unreachable): PagerDuty
- High (elevated error rate, integration failures): Slack `#platform-alerts`
- Medium (slow queries, job retries spiking): Slack `#platform-watch`
- Low (informational): logged only

## Disaster recovery

| Aspect | Mechanism |
|---|---|
| **Supabase PITR** | 7 days standard, 14 days target on Enterprise tier |
| **Independent backups** | Nightly logical backup to external S3-compatible storage |
| **Restore drills** | Quarterly tested restore procedure |
| **RPO** | ≤ 24 hours |
| **RTO** | ≤ 4 hours |
| **Runbook** | Documented incident response procedures for: DB corruption, region outage, security incident, mass data loss |

## Incident response

Tiers:
- **P0** — production outage, data loss, security breach. Page immediately. Engage all hands. Public status update within 30 minutes.
- **P1** — degraded production, single-tenant impact. Page on-call. Update affected customer within 2 hours.
- **P2** — feature broken, no immediate customer impact. Standard ticket flow.

Every P0/P1 produces a written postmortem within 5 business days, focused on systemic causes and process improvements (not individual blame). Postmortems often produce new Dev Control Plane tools.

---

# Scalability

## Targets

| Dimension | Target (MVP, year 1) | Target (year 3) |
|---|---|---|
| Organizations | 50 | 500 |
| Workshops | 100 | 1,500 |
| Active users | 1,500 | 15,000 |
| Cases/year | 75,000 | 750,000 |
| Time entries/year | 2M | 20M |
| Images stored | 1.5M (~7.5 TB) | 75M (~75 TB tiered) |
| Concurrent realtime users | 300 | 3,000 |
| Peak requests/sec | 50 | 500 |
| p95 page load on 4G | 1.5s | 1.5s |

Aggressive but realistic for Nordic vertical SaaS at this growth pace.

## Database scalability

| Bottleneck | Mitigation |
|---|---|
| Connection limits | Supavisor pooler (transaction mode); per-tenant connection budgets if needed |
| RLS overhead | Simple policies, `STABLE` functions, `organization_id` first in every multi-col index |
| Hot tables | Time-partitioning on audit_events and time_entries; case table stays modest size |
| Long-running reports | Materialized views refreshed nightly; complex ones moved to read replica |
| Storage growth | Audit partitions archived after 24 months; image lifecycle policy tiers to cold storage after 12 months from case closure |

### Triggers for next architectural step

| At this scale | Evaluate |
|---|---|
| ~250 orgs | Read replica for analytics workloads |
| Growing TakstKontroll usage | Extract TakstKontroll to its own database |
| ~500 orgs with sustained load | Sharding by `organization_id` (Citus or app-level) — only if metrics demand it |
| ~1,000 orgs | Regional deployment (one EU, possible second region for compliance) |

## Background jobs

Inngest scales horizontally with no code changes. Per-function concurrency pins prevent runaway:

| Function type | Concurrency |
|---|---|
| Heavy projections (KPI rebuilds) | 4 |
| External API calls | 1 per provider per org (rate-limit safety) |
| Notifications | 16 |
| Image processing | 8 |
| Cron jobs | Singleton (always) |

## Realtime

- Granular channels (workshop-scoped, not org-wide) minimize broadcast fanout
- High-frequency events (typing, cursor positions) deliberately excluded from Realtime
- Supabase Realtime handles thousands of concurrent connections per project; expansion to dedicated Realtime instance possible at scale

## Storage

- Image processing pipeline produces variants on upload (original + 1920px + 480px + 128px thumb)
- Default UI loads 480px; original served only on explicit "view original"
- Tenant-prefixed paths enable clean lifecycle policies
- Cold storage migration after 12 months from case closure
- Hard delete after retention window (10 years for financial, 5 years default)

## Mobile and edge performance

- Server Components for first paint → minimal JS shipped to floor devices
- Aggressive code splitting per route group
- PWA service worker for shell caching only; no offline writes (avoiding conflicts on shared production state — explicit choice)
- Workshop-floor UI tested on a $250 Android device on 4G as part of CI

## Cost model (indicative)

Monthly infrastructure cost at year-3 scale (500 orgs, ~15,000 active users):

| Service | Estimated monthly cost |
|---|---|
| Vercel (Enterprise) | $2,000 – $4,000 |
| Supabase (Pro+ / Enterprise) | $2,000 – $6,000 |
| Inngest | $500 – $1,500 |
| Sentry | $300 |
| Storage (Supabase + cold) | $1,000 – $3,000 |
| SMS / Email | Pass-through to customer |
| **Total** | **~$6,000 – $15,000 / month** |

Well within unit economics for B2B SaaS at workshop-floor pricing.

## Capacity planning

- Quarterly capacity review: examine actual vs projected usage, identify approaching limits
- Sentry performance trends inform UI optimization priorities
- Database query analysis runs weekly; top-N slow queries surfaced in Dev Control Plane
- KPI rebuild times tracked; if a projection takes longer than its refresh window, escalate to engineering
