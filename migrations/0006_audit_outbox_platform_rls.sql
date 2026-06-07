-- ===========================================================================
-- 0006_audit_outbox_platform_rls.sql — RLS for audit, outbox, platform tables
-- ===========================================================================
-- (docs/03-data-model.md § RLS, docs/06-developer-control-plane.md)
--
--   * audit_events: append-only — INSERT + SELECT policies only, no UPDATE/DELETE
--   * outbox_events / failed_events: org-scoped read; writes via service-role
--   * platform_* tables: NO tenant policies → invisible to tenant connections;
--     accessible only via the service-role (admin) connection that bypasses RLS
-- ===========================================================================

-- --- audit_events (append-only, org-scoped) ---------------------------------
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

-- Inserts allowed for the current org context (audit written in the same tx as
-- the mutation). No UPDATE/DELETE policies exist → rows are immutable.
CREATE POLICY audit_events_insert ON "audit_events"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY audit_events_select ON "audit_events"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());

-- --- outbox_events (org-scoped read/insert; publisher uses service role) -----
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY outbox_events_insert ON "outbox_events"
  FOR INSERT
  WITH CHECK (
    organization_id = app_current_org_id() OR organization_id IS NULL
  );

CREATE POLICY outbox_events_select ON "outbox_events"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());

-- --- failed_events (read-only to tenants/inspector; written by service role) -
ALTER TABLE "failed_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "failed_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY failed_events_select ON "failed_events"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());

-- --- platform tables: locked to the service-role connection only ------------
-- ENABLE + FORCE RLS with NO policies → tenant connections see nothing. The
-- service-role (admin) connection bypasses RLS for all platform operations.
ALTER TABLE "platform_users"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_users"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_role_assignments"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_role_assignments"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_permissions"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_permissions"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_role_permissions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_role_permissions"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_audit_events"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_audit_events"      FORCE ROW LEVEL SECURITY;
