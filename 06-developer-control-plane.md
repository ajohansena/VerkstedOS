# 06 — Developer Control Plane

The Developer Control Plane is the **owner-only operational cockpit** for running VerkstedOS. It is a first-class architectural domain — built into Sprint 1 of the platform, expanded sprint-by-sprint alongside customer features.

It is **never** accessible to customers, customer admins, or workshop users.

## Why this exists

As the platform grows, we must be able to diagnose, inspect, repair, and manage the system without requiring direct database access for routine operations. The Dev Control Plane becomes the operational cockpit.

If a class of incident has happened once and required `psql`, it becomes a Dev Control Plane tool the next time. Over time, direct DB access becomes a last-resort emergency activity, not a routine one.

## Core principles

1. **Complete separation from customer admin.** Different URL space, different middleware, different audit log, different role system, different UI.
2. **Owner/developer only.** No customer-org role can grant access. Platform roles are assigned by other platform owners only.
3. **Everything is audited.** Every read of sensitive customer data, every action, every impersonation, every emergency operation — in a dedicated platform audit log.
4. **Most operations are reversible.** Emergency actions (lock org, pause jobs) have explicit "undo" paths and time-bounded effects.
5. **No direct DB access for routine operations.** If a recurring problem required a SQL query, it becomes a Dev Control Plane tool.
6. **Tenant isolation is preserved during inspection.** Reading data through the control plane still uses tenant-aware queries; the platform user is *visiting* an org, not bypassing isolation.

## Hosting and routing

- Same Next.js application (avoids splitting auth, shared types, shared DB client)
- Dedicated route group `(dev)` under `src/app/(dev)/dev/...` with its own root layout and middleware
- URL prefix `/dev` everywhere
- In production: reverse-proxy or middleware rule restricts `/dev` to allow-listed IPs (office VPN, founder static IPs) **and** requires platform authentication
- Customer-facing app never renders any link to `/dev`. Discovery is via direct URL only.

## Identity and authorization

```
platform_users
 ├── user_id (FK users — same user identity, different track)
 ├── status               ('active' | 'disabled')
 ├── added_by_user_id
 ├── added_at
 └── notes

platform_role_assignments
 ├── id
 ├── platform_user_id
 ├── role                 ('PlatformOwner' | 'PlatformDeveloper' | 'PlatformSupport')
 ├── granted_by_user_id
 ├── granted_at
 ├── revoked_at (nullable)
 └── reason

platform_permissions       (catalog, code-defined)

platform_role_permissions  (which platform role has which permission)
```

A user with no row in `platform_users` cannot access `/dev` at all — middleware returns **404** (not 403; we don't acknowledge the surface exists).

## Platform permission catalog (≈18)

```
platform:org:view              platform:org:lock              platform:org:configure
platform:user:view             platform:user:impersonate      platform:user:disable
platform:audit:view            platform:event:view            platform:event:replay
platform:job:view              platform:job:retry             platform:job:pause
platform:integration:view      platform:integration:replay    platform:integration:disable
platform:data:repair           platform:flag:manage           platform:emergency:execute
```

Standard bundles:

| Role | Permissions |
|---|---|
| **PlatformOwner** | All platform permissions |
| **PlatformDeveloper** | All except `platform:emergency:execute` (requires PlatformOwner co-sign) |
| **PlatformSupport** | View-only across the board, plus `platform:user:impersonate` (with stricter audit and time limits) |

## Middleware and request lifecycle for `/dev`

```
1. Receive request on /dev/*
2. Verify Supabase JWT → user_id
3. Check platform_users for active row → otherwise return 404
4. Load platform_role_assignments and effective platform permissions
5. Optionally resolve target_org_id from URL/header (for inspection routes)
6. Set AsyncLocalStorage with:
     - platform_user_id
     - platform_roles
     - target_org_id (when inspecting a specific org)
7. Require platform permission per route (e.g. platform:audit:view)
8. Pipe DB queries through a special platform-mode Drizzle client:
     - SET LOCAL app.is_platform_inspector = true
     - SET LOCAL app.current_org_id = target_org_id (when applicable)
     - RLS policies recognize the inspector flag and allow READ-ONLY access
       to the targeted org's data
9. Execute, return response
10. Write to platform_audit_events
```

The `is_platform_inspector` session var unlocks read access across orgs but **never write access** by itself. Writes require an additional explicit step (typed reason, often a two-person rule).

## Platform audit

A separate table from customer audit:

```
platform_audit_events  (partitioned by month)
 ├── id
 ├── occurred_at
 ├── platform_user_id
 ├── platform_role_at_action
 ├── target_org_id (nullable)
 ├── target_user_id (nullable)
 ├── target_entity_type / target_entity_id (nullable)
 ├── action                ('viewed' | 'impersonated_started' | 'impersonated_ended' |
 │                          'event_replayed' | 'job_retried' | 'projection_rebuilt' |
 │                          'data_repaired' | 'org_locked' | 'org_unlocked' |
 │                          'feature_flag_changed' | 'integration_disabled' | ...)
 ├── before (jsonb, nullable)
 ├── after (jsonb, nullable)
 ├── reason (required for any state-changing action)
 ├── correlation_id
 └── metadata (jsonb)
```

**Reads of sensitive entities** (customer PII, financials) are also logged here with `action = 'viewed'`. This maintains accountability when the platform team has broad visibility.

## Capabilities

### User Management

| Capability | Mechanism |
|---|---|
| View any user | `/dev/users/[user_id]` — read-only profile with all memberships, role assignments, login history, permission grants |
| View all memberships | Listed on user profile |
| View role assignments | Same, with edit-history link |
| Impersonate users | See "Impersonation flow" below |
| Disable users | `/dev/users/[id]/disable` — sets `users.disabled_at`, revokes sessions |
| Force password reset | Triggers Supabase Auth password reset on the user's behalf |
| Unlock accounts | Clears lockout state |
| View login history | Reads from Supabase Auth audit + our auth_events |
| View permission history | Reads from `audit_events` filtered to role/grant tables |

### Organization Management

| Capability | Mechanism |
|---|---|
| View all organizations | `/dev/orgs` paginated list with health badges |
| View workshops / departments | Org profile drilldown |
| View configuration | Workflow definitions, KPI defs, feature flags, integrations |
| Enable/disable features | `/dev/orgs/[id]/flags` — writes `org_feature_flags`, audited |
| View subscription status | (Sprint 22+ when billing exists) |
| View usage statistics | Computed from KPIs and event counts |

### Data Inspection

Unified entity-search at `/dev/inspect`:

```
Search box accepts:
  - Vehicle reg → finds vehicles + linked cases
  - Case number → case + full timeline
  - Claim number → claim + cases
  - Customer name / phone / org_no → customer + cases
  - Employee email → user + memberships
  - Any UUID → direct lookup
  - Invoice number / PO number → invoice or PO

Entity detail page:
  - Full record (raw JSON inspector + formatted view)
  - All relationships
  - Audit timeline
  - Event stream
  - Related events (outbox + failed events)
```

### Audit & Event Inspection

```
/dev/audit                    — search across all audit_events
                                (filter by org, user, entity, action, date)
/dev/events/outbox            — current outbox; published / pending / failed
/dev/events/stream            — Inngest dashboard (embedded or linked)
/dev/events/failed            — failed events with replay button
/dev/events/[event_id]/replay — manual replay with platform audit
```

Replay semantics: replaying creates a new event with `replayed_from_id` set, never re-uses the original event_id. Idempotency keys ensure consumers handle replays safely.

### API & Integration Management

```
/dev/integrations
  ├── DBS: import history, webhook receipts, parse errors
  ├── Accounting: export history, last successful run, failures
  ├── SMS: provider health, delivery receipts, failure rates
  ├── Email: similar
  └── Outbound webhooks: per-subscription delivery history

/dev/api-keys                 — all keys across orgs; rotate / disable
/dev/integrations/inbox/[id]  — raw webhook payload, replay button
```

### Data Repair Tools

The most powerful and most dangerous section. Strict rules:

1. Every repair tool requires `platform:data:repair` permission.
2. Every execution requires a typed reason (free text, mandatory).
3. Every execution is recorded with full input/output to `platform_audit_events`.
4. **Destructive repairs** (anything that deletes or overwrites) require a **two-person rule**: a PlatformDeveloper can prepare the repair, a PlatformOwner must approve.

Initial repair tools:

```
/dev/repair/rebuild-projection
   - select projection (kpi_snapshots, part_reconciliation_status,
     case_current_state, ...)
   - select scope (single org / single workshop / single case / all)
   - dry-run first; preview deltas; then commit

/dev/repair/replay-events
   - select event stream, time window, consumers
   - dry-run; commit

/dev/repair/reprocess-import
   - select integration_inbox entries
   - re-run processing

/dev/repair/recompute-kpis
   - select KPI definition, scope, date range
```

**Repair tools never call ad-hoc SQL.** They call the same canonical services that the customer-facing app calls — same code path, just invoked from the control plane. This guarantees the repair uses the same business rules as production.

### Feature Flags

```
/dev/flags
  ├── per-org overrides
  ├── global rollouts (percentage by org)
  ├── kill switches (single-toggle disables across all orgs)
  └── feature dependency map (which flags depend on which)
```

Flag changes audited with before/after. Reverting a flag is one click.

### Monitoring & Diagnostics

```
/dev/health
  ├── System health (uptime, p95 latency, error rate from Sentry)
  ├── Database health (active connections, slow queries, RLS denial rate)
  ├── Queue health (Inngest backlog, retry rates, DLQ depth)
  ├── Storage health (Supabase Storage usage, image processing queue)
  ├── Integration status (each integration last success, current error rate)
  └── Realtime status (active channels, connected clients)
```

Pulls from Sentry API, Supabase logs, Inngest API, internal counters. No direct database polling on hot paths.

### Emergency Operations

```
/dev/emergency
  ├── Lock organization        (read-only mode for an org)
  ├── Unlock organization
  ├── Disable integration      (stop a misbehaving external connection)
  ├── Pause outbound webhooks  (stop emitting to subscribers)
  ├── Pause background jobs    (specific function or all)
  ├── Force maintenance mode   (global banner + 503 on writes)
  └── Disable user account
```

All emergency actions:
- Require `platform:emergency:execute` permission (PlatformOwner only)
- Require typed reason
- Audit-logged with full context
- Have an explicit revert button
- Surface a banner in customer-facing UI when applicable ("Your organization is in read-only mode — contact support")

## Impersonation flow (highest-risk capability)

```
1. Platform user navigates to /dev/users/[id]
2. Clicks "Impersonate" — requires platform:user:impersonate permission
3. Modal appears requiring:
     - typed reason (e.g. "Support ticket #1234 — customer can't see their cases")
     - duration (default 30 min, max 4 hours)
     - target organization (which membership to impersonate)
4. On confirm:
     - Create platform_impersonation_session row
     - Audit event: 'impersonated_started'
     - Issue a SHORT-LIVED JWT that carries:
         - platform_user_id (the actor — preserved)
         - impersonated_user_id (the target)
         - impersonation_session_id
         - exp = now + duration
5. Redirect to customer app as the impersonated user
6. Customer app middleware detects the impersonation claim:
     - Loads target user's memberships as if normal login
     - BUT renders a persistent banner: "Impersonating Lars Hansen at VerkstedAS — End"
     - Every audit event written during the session records BOTH user IDs:
         actor_kind = 'platform_impersonation'
         actor_user_id = platform user
         impersonated_user_id = customer user
7. Session ends on:
     - manual "End impersonation" click
     - duration expiry
     - logout
     - platform owner force-revoke
8. Audit event: 'impersonated_ended' with summary of actions taken
```

### Restrictions

- Impersonation never gains *platform* permissions; it only assumes the customer user's org permissions
- Certain actions are forbidden during impersonation regardless of permission: deleting users, exporting all data, changing payment methods. The customer must do those themselves.
- The impersonated user receives an email notification ("A support representative accessed your account on Y at Z for reason: …") — configurable per org but **default ON** for GDPR transparency

## Security considerations specific to the control plane

| Concern | Mitigation |
|---|---|
| Stolen platform credentials | Mandatory 2FA on platform_users; IP allow-listing in production |
| Lateral abuse | Sensitive actions trigger Slack alerts to `#platform-actions` |
| Insider misuse | Two-person rule on destructive repairs; full audit; quarterly access review |
| Data leak via /dev | All sensitive reads are logged; quarterly review of read patterns |
| Accidental write to wrong org | All write tools require typed org name confirmation (not just clicking) |
| Discovery of the surface | Production middleware returns **404** for non-platform users; no link from customer UI |

## Build phasing

The control plane grows with the platform:

| Sprint | Capability |
|---|---|
| Sprint 4 | Basic platform identity, audit log, org/user inspection (read-only) |
| Sprint 8 | Event inspection (outbox, failed events) + manual retry |
| Sprint 12 | Impersonation, feature flags, basic repair tools (rebuild projections) |
| Sprint 16 | Integration inspection, webhook replay |
| Sprint 20 | Emergency operations, monitoring dashboard, full repair suite |

The platform team uses each capability internally before customer-onboarding milestones depend on it.

## Three Surfaces (this module documenting its own coverage)

The Developer Control Plane itself complies with the Dev Panel Coverage Rule.

### User Surface
None. This is by design — customers must never interact with the control plane.

### Admin Surface
None. Workshop admins must never interact with the control plane.

### Dev Surface
The Dev Control Plane *is* this module's Dev Surface. It is self-inspecting:
- Platform users can view their own action history at `/dev/me/audit`
- Platform owners can review all platform user activity
- Two-person rule queue at `/dev/repair/pending-approval`
- Impersonation session monitor at `/dev/sessions/impersonation`
