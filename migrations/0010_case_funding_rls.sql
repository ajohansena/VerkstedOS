-- ===========================================================================
-- 0010_case_funding_rls.sql — RLS for Sprint 6 case/funding tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for cases, insurance_claims,
-- case_funding_sources, case_parties, case_notes. Hand-authored; forward-only.
-- All are org-scoped mutable operational records.
-- ===========================================================================

ALTER TABLE "cases"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cases"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "insurance_claims"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insurance_claims"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "case_funding_sources"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_funding_sources"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "case_parties"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_parties"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "case_notes"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_notes"             FORCE ROW LEVEL SECURITY;

CREATE POLICY cases_select ON "cases"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY cases_mutate ON "cases"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY insurance_claims_select ON "insurance_claims"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY insurance_claims_mutate ON "insurance_claims"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY case_funding_sources_select ON "case_funding_sources"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_funding_sources_mutate ON "case_funding_sources"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY case_parties_select ON "case_parties"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_parties_mutate ON "case_parties"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY case_notes_select ON "case_notes"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_notes_mutate ON "case_notes"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
