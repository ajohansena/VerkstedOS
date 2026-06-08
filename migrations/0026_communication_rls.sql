-- ===========================================================================
-- 0026_communication_rls.sql — RLS for Sprint 12 communication tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for communication threads, messages,
-- and case acceptances. Full org-scoped CRUD: message rows are append-CONTENT
-- (the service only updates delivery STATUS, never body/direction) and the
-- acceptance record is full-audited. Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "communication_threads"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_threads"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "communication_messages"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_messages"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "case_acceptances"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_acceptances"        FORCE ROW LEVEL SECURITY;

CREATE POLICY communication_threads_select ON "communication_threads"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY communication_threads_mutate ON "communication_threads"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY communication_messages_select ON "communication_messages"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY communication_messages_mutate ON "communication_messages"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY case_acceptances_select ON "case_acceptances"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY case_acceptances_mutate ON "case_acceptances"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
