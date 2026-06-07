-- ===========================================================================
-- 0008_customer_lookup_rls.sql — RLS for Sprint 5 customer/vehicle tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for the lookup caches and the
-- ownership-history projection. Hand-authored; forward-only.
--
--   * vegvesen_lookups / phone_lookups_1881: org-scoped caches (audit none).
--     Reads under org context; writes via the service-role connection.
--   * vehicle_ownership_history: append-only (audit event tier) — INSERT +
--     SELECT only, no UPDATE/DELETE policies, so history is immutable.
-- ===========================================================================

ALTER TABLE "vegvesen_lookups"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vegvesen_lookups"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "phone_lookups_1881"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phone_lookups_1881"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_ownership_history"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_ownership_history"   FORCE ROW LEVEL SECURITY;

-- --- vegvesen_lookups (org-scoped cache) ------------------------------------
CREATE POLICY vegvesen_lookups_select ON "vegvesen_lookups"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY vegvesen_lookups_mutate ON "vegvesen_lookups"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- phone_lookups_1881 (org-scoped cache) ----------------------------------
CREATE POLICY phone_lookups_1881_select ON "phone_lookups_1881"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY phone_lookups_1881_mutate ON "phone_lookups_1881"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- vehicle_ownership_history (append-only) --------------------------------
-- No UPDATE/DELETE policies → rows are immutable.
CREATE POLICY vehicle_ownership_history_insert ON "vehicle_ownership_history"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY vehicle_ownership_history_select ON "vehicle_ownership_history"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
