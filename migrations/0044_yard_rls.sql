-- Sprint 19 — RLS for yard management (yard_layouts, yard_locations,
-- vehicle_placements, vehicle_movements).
-- vehicle_movements is APPEND-ONLY (INSERT + SELECT only, no UPDATE/DELETE)
-- consistent with audit/lifecycle history tables across the codebase.

ALTER TABLE yard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY yard_layouts_org_isolation ON yard_layouts
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE yard_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY yard_locations_org_isolation ON yard_locations
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE vehicle_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_placements FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicle_placements_org_isolation ON vehicle_placements
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE vehicle_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicle_movements_org_insert ON vehicle_movements
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY vehicle_movements_org_select ON vehicle_movements
  FOR SELECT
  USING (organization_id = app_current_org_id());
