-- ===========================================================================
-- 0020_parts_rls.sql — RLS for Sprint 11 parts & inventory tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for the parts spine, procurement,
-- receipts, returns, and inventory. Two tables are APPEND-ONLY (INSERT + SELECT
-- only, no UPDATE/DELETE policy) because they are authoritative ledgers /
-- projections: inventory_stock_movements (the stock ledger — corrections are
-- compensating rows) and part_lifecycle_events (the timeline projection).
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "suppliers"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "supplier_agreements"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_agreements"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_requirements"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_requirements"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_lines"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_lines"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_receipts"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_receipts"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_receipt_lines"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_receipt_lines"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_returns"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_returns"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_return_lines"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_return_lines"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_stock_movements"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_stock_movements"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_withdrawals"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_withdrawals"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "part_lifecycle_events"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_lifecycle_events"      FORCE ROW LEVEL SECURITY;

-- --- Master data + spine + procurement (full org-scoped CRUD) ---------------

CREATE POLICY suppliers_select ON "suppliers"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY suppliers_mutate ON "suppliers"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY supplier_agreements_select ON "supplier_agreements"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY supplier_agreements_mutate ON "supplier_agreements"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_requirements_select ON "part_requirements"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_requirements_mutate ON "part_requirements"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY purchase_orders_select ON "purchase_orders"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY purchase_orders_mutate ON "purchase_orders"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY purchase_order_lines_select ON "purchase_order_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY purchase_order_lines_mutate ON "purchase_order_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_receipts_select ON "part_receipts"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_receipts_mutate ON "part_receipts"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_receipt_lines_select ON "part_receipt_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_receipt_lines_mutate ON "part_receipt_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_returns_select ON "part_returns"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_returns_mutate ON "part_returns"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_return_lines_select ON "part_return_lines"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_return_lines_mutate ON "part_return_lines"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY inventory_items_select ON "inventory_items"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY inventory_items_mutate ON "inventory_items"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY inventory_withdrawals_select ON "inventory_withdrawals"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY inventory_withdrawals_mutate ON "inventory_withdrawals"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- --- Append-only ledgers (INSERT + SELECT only — no UPDATE/DELETE policy) ----

CREATE POLICY inventory_stock_movements_select ON "inventory_stock_movements"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY inventory_stock_movements_insert ON "inventory_stock_movements"
  FOR INSERT WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY part_lifecycle_events_select ON "part_lifecycle_events"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY part_lifecycle_events_insert ON "part_lifecycle_events"
  FOR INSERT WITH CHECK (organization_id = app_current_org_id());
