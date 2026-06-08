-- ===========================================================================
-- 0018_work_segments_rls.sql — RLS for Sprint 10 planning tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for work segments, tasks, dependencies,
-- resource assignments, and the capacity snapshot projection. Hand-authored;
-- forward-only. (clock_sessions already has RLS from 0016; the new
-- work_segment_id column inherits the existing policies.)
-- ===========================================================================

ALTER TABLE "work_segments"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_segments"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "tasks"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks"                       FORCE ROW LEVEL SECURITY;
ALTER TABLE "work_segment_dependencies"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_segment_dependencies"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "resource_assignments"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_assignments"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "capacity_forecast_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "capacity_forecast_snapshots" FORCE ROW LEVEL SECURITY;

CREATE POLICY work_segments_select ON "work_segments"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY work_segments_mutate ON "work_segments"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY tasks_select ON "tasks"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY tasks_mutate ON "tasks"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY work_segment_dependencies_select ON "work_segment_dependencies"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY work_segment_dependencies_mutate ON "work_segment_dependencies"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY resource_assignments_select ON "resource_assignments"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY resource_assignments_mutate ON "resource_assignments"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY capacity_forecast_snapshots_select ON "capacity_forecast_snapshots"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY capacity_forecast_snapshots_mutate ON "capacity_forecast_snapshots"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
