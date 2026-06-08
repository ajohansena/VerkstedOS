-- ===========================================================================
-- 0032_multi_location_rls.sql — RLS for Sprint 13 multi-location tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for case assignments + transfers. Both
-- full-audit, org-scoped CRUD. A case can be assigned to / transferred between
-- any workshop WITHIN the org; cross-org isolation is enforced as usual.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "case_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "case_transfers"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_transfers"   FORCE ROW LEVEL SECURITY;

CREATE POLICY case_assignments_select ON "case_assignments"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_assignments_mutate ON "case_assignments"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY case_transfers_select ON "case_transfers"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_transfers_mutate ON "case_transfers"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
