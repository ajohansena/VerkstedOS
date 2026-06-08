-- ===========================================================================
-- 0016_workforce_rls.sql — RLS + constraints for Sprint 9 workforce tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001). Plus:
--   * a PARTIAL UNIQUE index enforcing ONE open clock session per employee
--   * time_entries are event-tier: corrections are NEW rows (kind='correction'),
--     never in-place edits — we allow INSERT + SELECT, and restrict UPDATE to
--     soft-delete/funding annotation only via the app layer (no UPDATE policy
--     would block legitimate funding tagging, so we keep an org-scoped UPDATE
--     but the service never rewrites an original entry's time).
-- Hand-authored; forward-only.
-- ===========================================================================

-- One OPEN clock session per employee (partial unique).
CREATE UNIQUE INDEX clock_sessions_one_open_per_employee
  ON "clock_sessions" ("employee_id")
  WHERE status = 'open';

ALTER TABLE "employees"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_skills"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_skills"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "resources"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "shift_definitions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_definitions"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "clock_sessions"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clock_sessions"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "time_entries"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_entries"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "absence_types"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absence_types"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "absence_entries"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absence_entries"    FORCE ROW LEVEL SECURITY;

CREATE POLICY employees_select ON "employees"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY employees_mutate ON "employees"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY employee_skills_select ON "employee_skills"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY employee_skills_mutate ON "employee_skills"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY resources_select ON "resources"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY resources_mutate ON "resources"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY shift_definitions_select ON "shift_definitions"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY shift_definitions_mutate ON "shift_definitions"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY clock_sessions_select ON "clock_sessions"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY clock_sessions_mutate ON "clock_sessions"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY time_entries_select ON "time_entries"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY time_entries_mutate ON "time_entries"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY absence_types_select ON "absence_types"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY absence_types_mutate ON "absence_types"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY absence_entries_select ON "absence_entries"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY absence_entries_mutate ON "absence_entries"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
