-- ===========================================================================
-- 0024_quality_rls.sql — RLS for Sprint 12 quality tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for QC checklists + deviations. All
-- full-audit, org-scoped CRUD. Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "checklist_templates"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_templates"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "checklist_template_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_template_items"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "checklist_runs"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_runs"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "checklist_responses"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_responses"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "quality_deviations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quality_deviations"        FORCE ROW LEVEL SECURITY;

CREATE POLICY checklist_templates_select ON "checklist_templates"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY checklist_templates_mutate ON "checklist_templates"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY checklist_template_items_select ON "checklist_template_items"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY checklist_template_items_mutate ON "checklist_template_items"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY checklist_runs_select ON "checklist_runs"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY checklist_runs_mutate ON "checklist_runs"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY checklist_responses_select ON "checklist_responses"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY checklist_responses_mutate ON "checklist_responses"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY quality_deviations_select ON "quality_deviations"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY quality_deviations_mutate ON "quality_deviations"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
