-- ===========================================================================
-- 0050_case_bookings_rls.sql — RLS for case_bookings (D2)
-- ===========================================================================
-- Org-scoping RLS consistent with 0010_case_funding_rls + 0032_multi_location_rls.
-- case_bookings is org-scoped CRUD; platform inspectors get cross-org SELECT.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "case_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_bookings" FORCE ROW LEVEL SECURITY;

CREATE POLICY case_bookings_select ON "case_bookings"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_bookings_mutate ON "case_bookings"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
