-- ===========================================================================
-- 0052_office_tasks_rls.sql — RLS for office_tasks (D3 Phase B)
-- ===========================================================================
-- Org-scoped CRUD; platform inspectors get cross-org SELECT.
-- Hand-authored, forward-only — mirrors 0050_case_bookings_rls.sql.
-- ===========================================================================

ALTER TABLE "office_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "office_tasks" FORCE ROW LEVEL SECURITY;

CREATE POLICY office_tasks_select ON "office_tasks"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY office_tasks_mutate ON "office_tasks"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
