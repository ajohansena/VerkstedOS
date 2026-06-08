-- ===========================================================================
-- 0012_estimate_rls.sql — RLS for Sprint 7 estimate/integration tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for the estimate aggregate and the
-- integration inbox. Hand-authored; forward-only.
--
-- Immutability (ADR-004, rule 4.7) is enforced primarily in the service layer
-- (locked imports + their lines are never updated; corrections create a new
-- version). RLS adds a belt-and-suspenders guard: locked estimate child rows
-- cannot be UPDATE-d by the tenant role.
--
-- integration_inbox is the pre-context landing zone: rows may have a NULL
-- organization_id until processing resolves it; writes happen on the
-- service-role connection (bypasses RLS).
-- ===========================================================================

ALTER TABLE "integration_inbox"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_inbox"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_imports"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_imports"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_documents"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_documents"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_operations"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_operations"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_labor_lines"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_labor_lines"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_paint_lines"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_paint_lines"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_parts"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_parts"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "estimate_totals"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estimate_totals"       FORCE ROW LEVEL SECURITY;

-- --- integration_inbox ------------------------------------------------------
CREATE POLICY integration_inbox_select ON "integration_inbox"
  FOR SELECT
  USING (
    app_is_platform_inspector()
    OR organization_id = app_current_org_id()
  );

-- --- estimate_imports (org-scoped) ------------------------------------------
CREATE POLICY estimate_imports_select ON "estimate_imports"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_imports_mutate ON "estimate_imports"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- estimate child tables: org-scoped read + INSERT; UPDATE only while the
--     parent import is NOT locked/superseded (immutability guard). -----------

CREATE POLICY estimate_documents_select ON "estimate_documents"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_documents_insert ON "estimate_documents"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_documents_update ON "estimate_documents"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_documents.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );

CREATE POLICY estimate_operations_select ON "estimate_operations"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_operations_insert ON "estimate_operations"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_operations_update ON "estimate_operations"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_operations.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );

CREATE POLICY estimate_labor_lines_select ON "estimate_labor_lines"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_labor_lines_insert ON "estimate_labor_lines"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_labor_lines_update ON "estimate_labor_lines"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_labor_lines.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );

CREATE POLICY estimate_paint_lines_select ON "estimate_paint_lines"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_paint_lines_insert ON "estimate_paint_lines"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_paint_lines_update ON "estimate_paint_lines"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_paint_lines.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );

CREATE POLICY estimate_parts_select ON "estimate_parts"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_parts_insert ON "estimate_parts"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_parts_update ON "estimate_parts"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_parts.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );

CREATE POLICY estimate_totals_select ON "estimate_totals"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY estimate_totals_insert ON "estimate_totals"
  FOR INSERT
  WITH CHECK (organization_id = app_current_org_id());
CREATE POLICY estimate_totals_update ON "estimate_totals"
  FOR UPDATE
  USING (
    organization_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM estimate_imports i
      WHERE i.id = estimate_totals.estimate_import_id
        AND i.status <> 'locked' AND i.status <> 'superseded'
    )
  );
