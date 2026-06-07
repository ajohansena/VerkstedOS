<!--
  VerkstedOS PR template. Every PR must complete this (CLAUDE.md § 11).
  For trivial changes (typo, dependency bump, copy edit), replace the
  Impact Analysis with: `N/A — non-functional change`.
-->

## Summary

<!-- 1-3 sentences: what changed and why. -->

## Sprint reference

Sprint N — task name

## System Impact Analysis (16 categories)

```
1.  Data Model:        new/modified entities, relationships, audit changes
2.  Business Logic:    calculations affected, authoritative service owner
3.  Workflow:          new states, transitions, planning effects
4.  User Role:         new permissions (with justification), role bundles, users affected
5.  Dashboard:         which dashboards need updates, KPI implications
6.  Reporting:         operational reports, management reports, exports
7.  API:               new/modified endpoints, versioning, external integrations
8.  Event:             new/modified events, projections, automations
9.  Notification:      user / customer / manager notifications
10. Audit:             new audit categories, tier (full/event/light), compliance
11. Security:          sensitive data exposure, tenant isolation, authz changes
12. Dev Control Plane: inspection, repair tools, replay capability, monitoring
13. Monitoring:        failure modes, metrics, alerts
14. Feature Flag:      rollout strategy, per-org config, reversibility
15. Real-Time:         channels affected, live UI updates required
16. Mobile:            mobile workflow effects, floor users, small-device usability
```

## Single Source of Truth

- Authoritative owner of any new calculation: \_\_\_\_
- Consumers redirected to canonical service: \_\_\_\_
- Registry entry added: \_\_\_\_

## Three Surfaces

```
User Surface
  Routes:
  Permissions:
  Workflows:

Admin Surface
  Routes:
  Permissions:
  Configurations:

Dev Surface
  Inspection:
  Repair:
  Replay/debug:
  Audit view:
  Monitoring:
```

## Risks

- \_\_\_\_

## Required follow-up tasks

- [ ] \_\_\_\_

## Pre-merge checklist

- [ ] Tests pass (unit + integration + tenant isolation)
- [ ] Type check clean (`pnpm typecheck`)
- [ ] Lint clean (`pnpm lint`)
- [ ] Format check clean (`pnpm format:check`)
- [ ] Module boundary check passes (`pnpm depcruise`)
- [ ] No raw SQL in service code
- [ ] No inline calculation in presentation
- [ ] Documentation updated
- [ ] PR template completed in full
- [ ] Three Surfaces verified
- [ ] Permissions added to catalog with justification (if new)
- [ ] Migration reviewed by hand (if Drizzle generated one)
- [ ] RLS policies in place (if new tables)
- [ ] Demoable to project owner
