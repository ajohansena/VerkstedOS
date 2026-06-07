# 05 — Multi-Tenant and RBAC

## Tenant hierarchy

```
Organization                   ← top tenant root (chain or single shop)
├── Workshop                   ← physical location
│   ├── Department             ← lightweight functional grouping
│   └── (operational data)
└── (shared services: customers, insurance, finance, KPIs, ...)
```

- **Organization** is the only tenant root. There is no concept above it. An "enterprise group" is just an Organization with multiple workshops.
- **Workshop** is a child of Organization. Operationally significant but not a tenant boundary.
- **Department** is a child of Workshop. Lightweight grouping for resources and optional RBAC scoping.
- Cases, customers, claims, suppliers, etc. live at **Organization** level. This is what makes A → B → C → A work — the case never "belongs" to a workshop.

## Request lifecycle for tenant context

```
1. Request arrives (Next.js server action or route handler)
        ↓
2. Middleware: validate Supabase JWT → user_id
        ↓
3. Resolve user's memberships → if multiple orgs, pick from session
        ↓
4. Load effective context:
        - organization_id
        - default_workshop_id
        - accessible_workshop_ids[]
        - accessible_department_ids[]
        - permission_set[]
        - feature_flags[]
        ↓
5. Stash context in AsyncLocalStorage (request-scoped)
        ↓
6. Service-layer code runs; calls DB through tenant-aware Drizzle client
        ↓
7. Drizzle client begins transaction with:
        SET LOCAL app.current_org_id      = ...
        SET LOCAL app.current_user_id     = ...
        SET LOCAL app.current_workshop_id = ...
        ↓
8. All queries filtered by RLS using those session vars
        ↓
9. On commit: outbox events flushed; audit rows in same tx
        ↓
10. Response returned
```

Key properties:
- **No code path can run a DB query without org context.** The tenant-aware client refuses to start a query without it. Getting a "raw" client requires an explicit `as: 'admin' | 'integration' | 'platform-inspector'` flag and is grep-able.
- **Session vars set per transaction**, not per connection. Supabase uses a connection pool — using `SET LOCAL` (not `SET`) scopes the change to the transaction only.

## Cross-workshop and cross-department access

Three scope models combine to produce effective access:

| Scope | Storage | Used for |
|---|---|---|
| **Org-wide** | implicit via Membership | A user with a role *across all* workshops in the org |
| **Workshop-scoped** | `role_assignments.workshop_id` | A Department Manager whose authority is one workshop |
| **Department-scoped** | `role_assignments.department_id` | A Paint Manager limited to the Paint Department |

Cross-department read access uses **read-only role assignments**:

```
Paint Manager Lars:
  ├── Role: DepartmentManager  @ org A, workshop Oslo, dept Paint   (full)
  ├── Role: Viewer             @ org A, workshop Oslo, dept Body    (read)
  └── Role: Viewer             @ org A, workshop Oslo, dept Assembly (read)
```

The effective permission set for a request is the union of all role assignments × their permissions, projected onto the entity being accessed.

## Enterprise (chain) reads

An Enterprise Administrator gets a role assignment at **organization level** (workshop_id NULL, department_id NULL) with a permission bundle that includes `view:cross_workshop`.

The `accessible_workshop_ids[]` for this user includes every workshop in the org. Their queries naturally span workshops; RLS still constrains to `organization_id` so they cannot see other organizations.

## Cross-organization access (rare)

True multi-org users (e.g. a consultant working for three independent chains) have a separate `Membership` per organization. They pick the active org at the top of the UI; that choice sets the org context for the session. Their *current* permission set is always single-org.

This is intentionally restrictive. We do not federate identities across organizations.

## Data sharing configuration

| Data class | Default sharing | Configurable? |
|---|---|---|
| Customers | Org-wide | No (uniqueness at org level) |
| Vehicles | Org-wide | No |
| Cases | Org-wide; current workshop denormalized | Operational visibility per role |
| Resource capacity / employees | Workshop | Yes — workshops can share specialists |
| Yard | Workshop | No |
| Suppliers | Org-wide | No |
| Insurance claims | Org-wide | No |
| KPI definitions, workflow definitions | Org-wide | No (org owns config) |
| Notification rules | Org-wide with workshop overrides | Yes |

# RBAC

## Principles

1. **Roles are data**, not code. The system ships with seed data for standard roles; orgs can edit, duplicate, or replace them.
2. **Permissions are code**, not data. The catalog is defined in TypeScript, exhaustively enumerated, version-controlled, and seeded.
3. **Authorization is checked in two places**: explicitly in the service layer (rich, business-aware), and defensively via RLS in the database (coarse, fail-closed).
4. **Effective permission is the union** of all role assignments + direct user grants, scoped appropriately.
5. **Permission discipline**: before introducing a new permission, evaluate whether an existing permission can solve the same problem. Expand by splitting, not by layering.

## MVP permission catalog (≈24)

Organized in 8 groups of 3:

```
case:view          case:edit          case:transfer
estimate:view      estimate:edit      estimate:lock
production:view    production:plan    production:transition
time:self          time:other         time:correct
parts:view         parts:order        parts:reconcile
quality:view       quality:edit       quality:signoff
finance:view       finance:invoice    finance:export
admin:users        admin:config       admin:audit
```

(`time:self` covers clock-in/clock-out for the current user; `time:other` covers managing other employees' time; `time:correct` is the privileged correction action.)

## MVP standard roles (6)

| Role | Permission bundle |
|---|---|
| **Owner** | All permissions (the only role that can grant `admin:audit` to others) |
| **Admin** | All permissions except `admin:users` and `admin:audit` restricted |
| **Estimator** | case:view/edit, estimate:*, parts:view/order, quality:view, finance:view |
| **Technician** | case:view, production:view/transition, time:self, parts:view, quality:view/edit |
| **Accounting** | case:view, finance:*, parts:view/reconcile |
| **Viewer** | *:view only |

These six cover the realistic span of MVP workshop personas.

## Role assignment model

```
role_assignments
 ├── id
 ├── organization_id
 ├── membership_id          (which user-in-org)
 ├── role_id                (which role)
 ├── workshop_id            (NULL = org-wide)
 ├── department_id          (NULL = workshop-wide or org-wide)
 ├── valid_from
 ├── valid_until            (nullable — for temporary delegation)
 ├── assigned_by_user_id
 ├── created_at
```

A single user can have many role assignments. Examples:

```
Paint Manager Lars:
  ├── DepartmentManager  @ org A, workshop Oslo, dept Paint
  ├── Viewer             @ org A, workshop Oslo, dept Body
  └── Viewer             @ org A, workshop Oslo, dept Assembly

CEO of chain:
  └── EnterpriseAdmin    @ org A   (workshop_id NULL, dept_id NULL)

Estimator working at two branches:
  ├── Estimator          @ org A, workshop Oslo
  └── Estimator          @ org A, workshop Bergen

Temporary substitute manager:
  └── DepartmentManager  @ org A, workshop X, dept Paint
       valid_from 2026-06-10, valid_until 2026-06-24
```

## Direct user permission grants

For exceptions outside roles:

```
user_permission_grants
 ├── id
 ├── organization_id
 ├── membership_id
 ├── permission_code        (e.g. 'finance:export')
 ├── workshop_id            (nullable)
 ├── department_id          (nullable)
 ├── kind                   ('grant' | 'deny')
 ├── reason                 (required text)
 ├── granted_by_user_id
 ├── valid_from, valid_until
```

`kind = 'deny'` revokes a permission a role would otherwise grant. Deny wins over grant. Use sparingly; this is a power tool with a paper trail.

## Effective permission resolution

Function `has_permission(user, org, permission, target_workshop?, target_department?)`:

1. Build the user's active role assignments (valid time window).
2. For each role assignment, expand to its permission set, filtered to those whose scope covers the requested target.
3. Add direct grants whose scope covers the target.
4. Remove direct denies whose scope covers the target.
5. Return boolean.

Implementation:
- Cached per-request in AsyncLocalStorage
- Recomputed when role/grant changes (cache busted by event)
- SQL function `app.has_permission(perm text)` consults a denormalized `effective_permissions_cache` table keyed on `(user_id, organization_id)` for fast RLS evaluation
- The cache is refreshed via triggers when role assignments change

## Permission expansion path (post-MVP)

The catalog grows by **splitting** existing permissions, not by inventing new categories:

```
case:edit  →  case:edit_basic, case:edit_financial, case:reassign_workshop
parts:order →  parts:po_create, parts:po_approve, parts:po_cancel
finance:invoice → finance:invoice_basis_generate, finance:invoice_send, finance:invoice_credit
admin:config  → admin:workflow, admin:notifications, admin:integrations, admin:feature_flags
```

Existing role definitions auto-receive the split permissions (a role that had `case:edit` now has both `case:edit_basic` and `case:edit_financial` after migration). Orgs that want finer control then unbundle manually.

### Migration

1. New permissions added in catalog migration with a `replaces` field
2. One-time data migration grants new permissions to every role that had the replaced permission
3. Old permission marked deprecated; checks fall back through replacements
4. After a cutover window, old permission removed
5. UI shows "Refine permissions" hint on roles with replaced-bundle permissions

No code that does `has_permission('case:edit')` breaks during expansion — the function understands replacement chains.

## Platform-level roles (separate track)

Platform roles are **not** in the org-level RBAC system. They are a separate identity track described in [06-developer-control-plane.md](./06-developer-control-plane.md).

```
PlatformOwner          (founders / ops leadership)
PlatformDeveloper      (engineering team)
PlatformSupport        (customer support team)
```

A user can hold both a platform role and customer org roles. The two systems are evaluated independently — a workshop technician cannot accidentally become a platform admin through customer-side RBAC.

## Authorization in code

```typescript
// Service layer (always):
await requirePermission(ctx, 'case:transfer', { workshopId, caseId });
// then proceed to mutate
```

```sql
-- RLS (defense-in-depth):
CREATE POLICY case_update ON cases
  FOR UPDATE
  USING (
    organization_id = app.current_org_id()
    AND app.has_permission('case:edit')
  );
```

Two layers, both required. RLS won't catch a logic bug that calls the wrong service; service code won't catch a SQL injection that bypasses ORM. Together they do.

## Authorization pipeline (uniform across endpoints)

Every Route Handler and Server Action runs through the same pipeline:

```
1. authenticate()           → user_id or fail 401
2. resolveContext(orgId?)   → load org, memberships, permissions
3. requirePermission(perm)  → 403 if missing
4. validateInput(schema)    → Zod; 400 if invalid
5. service.execute(ctx, input)
6. mapErrors → response
```

The pipeline is wrapped in a helper so every endpoint looks the same. No endpoint can "forget" auth.
