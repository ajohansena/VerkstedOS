-- ===========================================================================
-- 0022_documents_rls.sql — RLS for Sprint 12 documents tables
-- ===========================================================================
-- Org-scoping RLS (consistent with 0001) for the cross-cutting documents spine.
-- `document_access_events` is APPEND-ONLY (INSERT + SELECT only) — it is the
-- audit log for sensitive-file access, never edited in place. Hand-authored;
-- forward-only.
-- ===========================================================================

ALTER TABLE "documents"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_links"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_links"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_access_events"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_access_events"  FORCE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON "documents"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY documents_mutate ON "documents"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY document_links_select ON "document_links"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY document_links_mutate ON "document_links"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- Append-only access log (INSERT + SELECT only — no UPDATE/DELETE policy).
CREATE POLICY document_access_events_select ON "document_access_events"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY document_access_events_insert ON "document_access_events"
  FOR INSERT WITH CHECK (organization_id = app_current_org_id());
