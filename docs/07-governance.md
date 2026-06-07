# 07 — Governance

This document defines the **three non-negotiable architecture rules** that apply to every feature, every PR, every sprint, indefinitely.

These are not suggestions. They are the constitution of how VerkstedOS is built.

---

## Rule 1 — System Impact Analysis

> Every feature, workflow, entity, integration, report, dashboard, automation, calculation, API endpoint, status change, or business process must complete a full System Impact Analysis before implementation is considered complete.

A feature is **NOT** complete when the local functionality works. A feature is only complete after a full system impact analysis has been performed.

### Core principle

Before implementing any change, identify all areas of the platform that may be affected. Prevent local optimizations that create inconsistencies elsewhere.

Do not think *"this feature works."* Think *"what other parts of the platform depend on this feature?"*

### Mandatory checklist (16 categories)

For every feature, workflow, or change, evaluate each category:

#### 1. Data Model Impact
- Are new entities required?
- Are existing entities affected?
- Are relationships affected?
- Are historical records affected?
- Does audit history change?

#### 2. Business Logic Impact
- Does this affect calculations?
- Does this affect pricing?
- Does this affect profitability?
- Does this affect KPIs?
- Does this affect production flow?
- Does this affect financial reporting?

Identify all shared business logic that may be affected. **Never duplicate business logic.** Always use existing authoritative calculation services where possible.

#### 3. Workflow Impact
- Does this introduce new statuses?
- Does this change status transitions?
- Does this affect production flow?
- Does this affect planning?
- Does this affect assignments?
- Does this affect transfers between departments?

#### 4. User Role Impact
- Which users can access this?
- Which users can modify this?
- Does this affect permissions?
- Does this affect role assignments?
- Does this require new permissions?

(Recall the permission discipline rule: before introducing a new permission, evaluate whether an existing permission solves the same problem.)

#### 5. Dashboard Impact
- Does this affect existing dashboards?
- Does this affect KPI calculations?
- Does this affect reporting?

#### 6. Reporting Impact
- Operational reports?
- Management reports?
- Exports?
- Accounting reports?

#### 7. API Impact
- New endpoints?
- Modified endpoints?
- External integrations affected?
- Versioning needed?

#### 8. Event Impact
- Should new events be emitted?
- Should existing events change?
- Do projections need updating?
- Do automations depend on this?

#### 9. Notification Impact
- Should users be notified?
- Should customers be notified?
- Should managers be notified?
- Are existing notifications affected?

#### 10. Audit Impact
- Should this action be audited?
- Is before/after history required (full audit tier)?
- Does compliance require traceability?

#### 11. Security Impact
- Does this expose sensitive information?
- Does this require additional validation?
- Does this affect tenant isolation?
- Does this affect authorization rules?

#### 12. Dev Control Plane Impact
- How will platform owners inspect this?
- How will support investigate problems?
- How will developers debug failures?
- How will data be repaired?
- How will events be replayed?
- How will audits be viewed?

Every feature must define its Dev Surface (see Rule 3).

#### 13. Monitoring Impact
- What can fail?
- How will failures be detected?
- What should be logged?
- What metrics should be tracked?
- What alerts should exist?

#### 14. Feature Flag Impact
- Should this be rolled out gradually?
- Should it be enabled per organization?
- Should it be reversible?

#### 15. Real-Time Impact
- Should live updates occur?
- Which screens require updates?
- Which channels are affected?

#### 16. Mobile Impact
- Does this affect mobile workflows?
- Does this affect workshop-floor users?
- Does the UI remain usable on small devices?

---

## Rule 2 — Single Source of Truth

> Every KPI, calculation, financial formula, status rule, workflow rule, and business metric must have one authoritative owner.

Never implement the same calculation in:
- Dashboards
- Reports
- Components
- Pages
- APIs

Instead: create one authoritative business service and make all consumers use it.

### Implementation

Every bounded context has an `application/calculations/` directory:

```
src/modules/<context>/application/calculations/
   ├── productivity.ts        — sold / produced / registered hours, efficiency
   ├── case-financials.ts     — per-case revenue, costs, margin (by funding source)
   ├── workshop-capacity.ts   — available vs allocated hours
   ├── throughput.ts          — average throughput, bottleneck detection
   ├── reconciliation.ts      — part requirement vs ordered/received/invoiced
   └── ...
```

### Calculation rules

- Calculation modules export **pure** functions (or service classes with no I/O)
- Inputs are domain objects; outputs are typed result objects
- Dashboards, reports, APIs, server actions, and Dev Control Plane all call the same calculation
- Tests live alongside; calculations are tested in isolation

### Metric registry

A central registry documents which calculation owns which metric:

```typescript
// src/metrics/registry.ts
export const metricRegistry = {
  'sold_hours':              { module: 'workforce', calc: 'calculateSoldHours' },
  'produced_hours':          { module: 'workforce', calc: 'calculateProducedHours' },
  'registered_hours':        { module: 'workforce', calc: 'calculateRegisteredHours' },
  'efficiency':              { module: 'workforce', calc: 'calculateEfficiency' },
  'case_margin_per_funder':  { module: 'case', calc: 'calculateFundingMargin' },
  'rework_rate':             { module: 'quality', calc: 'calculateReworkRate' },
  'part_reconciliation_state': { module: 'parts', calc: 'computeReconciliation' },
  // ...
};
```

### Workflow

When a new feature wants a calculation:
1. **Check the registry.** If it exists, use it.
2. **If it doesn't exist**, add to the registry (which means defining its owner)
3. **If something similar exists with a slight variation**, refactor the original to take parameters rather than duplicating

### CI enforcement

A lint rule flags inline arithmetic involving hours, money, or percentages in presentation code. Such code must call into a calculation module. The rule prevents drift even when reviewers miss duplication.

### Calculations as events

For Single Source of Truth to extend to historical data, calculations that drive KPIs are projected via the event system. When a `time.entry_recorded` event fires, the productivity projector recomputes the relevant rollups using the same calculation module that the dashboard uses live. Same formula, same rounding, same edge-case handling, everywhere.

---

## Rule 3 — Dev Panel Coverage

> Every new module, entity, workflow, integration, or feature must define User Surface, Admin Surface, and Dev Surface before it is considered complete.

If only the user surface ships, the Dev Control Plane falls behind the customer-facing platform. Over time this makes incidents harder to diagnose and harder to fix without direct DB access — exactly what the Dev Control Plane exists to prevent.

### The three surfaces

| Surface | Who uses it | Purpose |
|---|---|---|
| **User Surface** | End users (technicians, estimators, managers, customers) | Day-to-day operations |
| **Admin Surface** | Organization admins (workshop owners, IT) | Configuration, customization, oversight within the org |
| **Dev Surface** | Platform owners and developers | Inspection, repair, replay, monitoring, debugging |

### Example: Case Transfer feature

**User Surface**
- Routes: `/cases/:id/transfer`
- Permissions: `case:transfer`
- Workflow: transfer modal → select target workshop → confirm → produces `CaseTransfer` event

**Admin Surface**
- Routes: `/admin/transfers/policies`
- Permissions: `admin:config`
- Configurations: which workshops can transfer to which (defaults, restrictions); allowed transport modes

**Dev Surface**
- Routes: `/dev/transfers`, `/dev/transfers/:id`
- Permissions: `platform:org:view`, `platform:event:replay`, `platform:data:repair`
- Capabilities:
  - Search transfers across all orgs
  - View transfer history for a case
  - Replay transfer events (re-emit move-images / move-documents jobs)
  - Repair stuck transfers (case stuck in "in transit")
  - View audit trail for a transfer
  - View related failed events

### Completion criteria

A feature is not "Done" until the PR description has all three surfaces explicitly listed. PRs without this section are blocked at review.

---

# PR Template

This template lives in `.github/PULL_REQUEST_TEMPLATE.md`. Every PR must use it.

```markdown
## Description
[1-3 sentence description of the change]

## System Impact Analysis

### Summary
[1-2 sentences]

### 1. Data Model Impact
- New entities: 
- Modified entities: 
- Modified relationships: 
- Historical record implications: 
- Audit history changes: 

### 2. Business Logic Impact
- Calculations affected: 
- Authoritative service owning the calculation: 
- New shared logic introduced: 
- Risk of duplicated logic: 

### 3. Workflow Impact
- New states: 
- Modified transitions: 
- Effects on planning / assignment / transfer: 

### 4. User Role Impact
- New permissions (and justification — can existing solve this?): 
- Modified role bundles: 
- Users affected: 

### 5. Dashboard Impact
- Dashboards needing update: 
- KPI implications: 

### 6. Reporting Impact
- Operational reports: 
- Management reports: 
- Accounting exports: 

### 7. API Impact
- New endpoints: 
- Modified endpoints: 
- Versioning required: 
- External integration impact: 

### 8. Event Impact
- New events: 
- Modified events: 
- Affected projections: 
- Automations depending on events: 

### 9. Notification Impact
- User notifications: 
- Customer notifications: 
- Manager notifications: 

### 10. Audit Impact
- New audit categories: 
- Tier (full / event / light / none): 
- Compliance implications: 

### 11. Security Impact
- Sensitive data exposure: 
- Tenant isolation effects: 
- Authorization rule changes: 

### 12. Dev Control Plane Impact
- Inspection surface: 
- Repair tools needed: 
- Replay / debug capability: 
- Monitoring hooks: 

### 13. Monitoring Impact
- Failure modes: 
- Metrics to track: 
- Alerts to add: 

### 14. Feature Flag Impact
- Rollout strategy: 
- Per-org configurability: 
- Reversibility: 

### 15. Real-Time Impact
- Realtime channels affected: 
- Live UI updates required: 

### 16. Mobile Impact
- Mobile workflow effects: 
- Floor-user impact: 
- Small-device usability: 

## Single Source of Truth
- Authoritative owner of any new calculation: 
- Consumers redirected to canonical service: 
- Registry entry added: 

## Three Surfaces

### User Surface
- Routes: 
- Permissions: 
- Workflows: 

### Admin Surface
- Routes: 
- Permissions: 
- Configurations: 

### Dev Surface
- Inspection: 
- Repair: 
- Replay / debug: 
- Audit view: 
- Monitoring: 

## Risks
- 

## Required follow-up tasks
- [ ] 

## Checklist
- [ ] Impact Analysis completed
- [ ] Three Surfaces defined
- [ ] Tests pass
- [ ] Module boundary check passes (dependency-cruiser)
- [ ] No raw SQL in service code
- [ ] No inline calculation in presentation
- [ ] Tenant isolation tests still pass
```

### Trivial changes

For typo fixes, dependency bumps, and copy edits, the template is acknowledged with `N/A — non-functional change` rather than skipped.

---

# ADR Template

For architecturally significant decisions, create an ADR in `docs/adrs/NNNN-title.md`:

```markdown
# ADR-NNNN: [Title]

## Status
Proposed | Accepted | Superseded by ADR-XXXX

## Context
What is the issue we're addressing? What forces are at play?

## Decision
What we decided.

## Rationale
Why we decided this. Trade-offs considered.

## Alternatives considered
What else we evaluated and why we rejected each.

## Consequences
What becomes easier? What becomes harder? What are the risks?

## Impact Analysis
[Use the 16-category checklist from Rule 1]

## Three Surfaces
[Use the User / Admin / Dev surface definition from Rule 3]
```

---

# Permission discipline rule (locked)

> Before introducing a new permission, evaluate whether an existing permission can solve the same problem. New permissions are added by *splitting* existing ones, not by *layering* new categories. Any new permission requires written justification in the PR description.

This is added to the governance process. The permission catalog file has a comment header stating this rule. Reviewers enforce it.

---

# Enforcement summary

| Rule | Enforcement mechanism |
|---|---|
| System Impact Analysis | PR template; PRs without it fail review |
| Single Source of Truth | Calculation registry; ESLint rule flagging inline arithmetic in presentation code |
| Dev Panel Coverage | PR template (Three Surfaces section); sprint review |
| Permission discipline | PR review; permission catalog comment header |
| Module boundaries | `dependency-cruiser` in CI |
| No raw SQL in service code | ESLint rule |
| Audit tier compliance | Repository wrappers; lint rule against direct table writes outside repos |
| Tenant isolation | Integration test suite that must pass before any merge |
