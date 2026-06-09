-- ===========================================================================
-- 0036_finance_invoicing_rls.sql — RLS for Sprint 15 finance invoicing tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001 / 0034) for invoice bases, their lines,
-- accounting exports, and export lines. Full org-scoped CRUD — finance is
-- governed at the application layer by the existing `finance:view` /
-- `finance:invoice` / `finance:export` permissions (no new permission added;
-- catalog stays frozen at 24). Platform inspectors get read access via
-- app_is_platform_inspector().
--
-- The export header is updated in place by the retry flow (status / attempt
-- count), so it carries full CRUD like the rest; the immutability guarantee is
-- enforced in the service (history is never rewritten, only appended /
-- forward-stepped) and proven by the stored payload hash.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "invoice_basis"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_basis"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_basis_lines"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_basis_lines"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "accounting_exports"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_exports"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "accounting_export_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_export_lines" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_basis_select ON "invoice_basis"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY invoice_basis_mutate ON "invoice_basis"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY invoice_basis_lines_select ON "invoice_basis_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY invoice_basis_lines_mutate ON "invoice_basis_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY accounting_exports_select ON "accounting_exports"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY accounting_exports_mutate ON "accounting_exports"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY accounting_export_lines_select ON "accounting_export_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY accounting_export_lines_mutate ON "accounting_export_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
