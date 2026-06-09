-- Sprint 18 — RLS for absence approval + rental subsystem.
-- All four rental tables + the new absence approval columns are org-scoped
-- with FORCE RLS (org-isolated by `organization_id`).

ALTER TABLE rental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_vehicles FORCE ROW LEVEL SECURITY;
CREATE POLICY rental_vehicles_org_isolation ON rental_vehicles
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE rental_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY rental_reservations_org_isolation ON rental_reservations
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements FORCE ROW LEVEL SECURITY;
CREATE POLICY rental_agreements_org_isolation ON rental_agreements
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

ALTER TABLE rental_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_returns FORCE ROW LEVEL SECURITY;
CREATE POLICY rental_returns_org_isolation ON rental_returns
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
