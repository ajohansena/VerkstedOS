-- ===========================================================================
-- 0034_supplier_invoice_rls.sql — RLS for Sprint 14 supplier invoicing tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001 / 0020) for supplier invoices, lines,
-- credit notes, and credit-note lines. Full org-scoped CRUD — supplier
-- invoicing is governed by the `parts:reconcile` permission at the application
-- layer (no new permission added; Sprint 14 catalog is frozen). Platform
-- inspectors get read access via app_is_platform_inspector().
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "supplier_invoices"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_invoices"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "supplier_invoice_lines"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_invoice_lines"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "supplier_credit_notes"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_credit_notes"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "supplier_credit_note_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_credit_note_lines" FORCE ROW LEVEL SECURITY;

CREATE POLICY supplier_invoices_select ON "supplier_invoices"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY supplier_invoices_mutate ON "supplier_invoices"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY supplier_invoice_lines_select ON "supplier_invoice_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY supplier_invoice_lines_mutate ON "supplier_invoice_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY supplier_credit_notes_select ON "supplier_credit_notes"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY supplier_credit_notes_mutate ON "supplier_credit_notes"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY supplier_credit_note_lines_select ON "supplier_credit_note_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY supplier_credit_note_lines_mutate ON "supplier_credit_note_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
