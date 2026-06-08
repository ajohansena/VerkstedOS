-- ===========================================================================
-- 0014_production_workflow_rls.sql — RLS for Sprint 8 production tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001). production_state_history is
-- APPEND-ONLY (audit tier event): INSERT + SELECT only, no UPDATE/DELETE — the
-- transition log is immutable (Sprint 8 guardrail: it is the authoritative
-- record of how status evolved). Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "workflow_definitions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_definitions"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_states"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_states"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_transitions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_transitions"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "production_orders"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_orders"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "production_state_history"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_state_history"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "production_holds"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_holds"          FORCE ROW LEVEL SECURITY;

-- --- workflow_definitions ---------------------------------------------------
CREATE POLICY workflow_definitions_select ON "workflow_definitions"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY workflow_definitions_mutate ON "workflow_definitions"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- workflow_states --------------------------------------------------------
CREATE POLICY workflow_states_select ON "workflow_states"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY workflow_states_mutate ON "workflow_states"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- workflow_transitions ---------------------------------------------------
CREATE POLICY workflow_transitions_select ON "workflow_transitions"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY workflow_transitions_mutate ON "workflow_transitions"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- production_orders (org-scoped) -----------------------------------------
CREATE POLICY production_orders_select ON "production_orders"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY production_orders_mutate ON "production_orders"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- production_state_history (APPEND-ONLY) ---------------------------------
-- No UPDATE/DELETE policies → the transition log is immutable.
CREATE POLICY production_state_history_insert ON "production_state_history"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY production_state_history_select ON "production_state_history"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());

-- --- production_holds (org-scoped) ------------------------------------------
CREATE POLICY production_holds_select ON "production_holds"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY production_holds_mutate ON "production_holds"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
