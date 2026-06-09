-- ===========================================================================
-- 0038_dashboards_kpi_rls.sql — RLS for Sprint 16 dashboard / KPI tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001 / 0036) for KPI definitions and
-- snapshots. Full org-scoped CRUD — KPI definitions are configured under
-- `admin:config` and snapshots are written by the nightly job under the org
-- context; dashboards read them under `case:view` / role permissions at the
-- application layer (no new permission; catalog frozen at 24). Platform
-- inspectors get read access via app_is_platform_inspector().
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "kpi_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kpi_definitions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "kpi_snapshots"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kpi_snapshots"   FORCE ROW LEVEL SECURITY;

CREATE POLICY kpi_definitions_select ON "kpi_definitions"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY kpi_definitions_mutate ON "kpi_definitions"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY kpi_snapshots_select ON "kpi_snapshots"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY kpi_snapshots_mutate ON "kpi_snapshots"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
