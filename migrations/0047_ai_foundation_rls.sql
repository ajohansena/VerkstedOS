-- ===========================================================================
-- 0047_ai_foundation_rls.sql — RLS for Sprint 21 AI foundation tables
-- ===========================================================================
-- `ai_model_versions` is a PLATFORM-LEVEL registry (no per-org RLS — read by
-- everyone with platform-inspector access; written only via the Dev plane).
-- `ai_predictions` IS tenant-scoped: org isolation + platform-inspector read.
-- Hand-authored; forward-only.
-- ===========================================================================

-- Predictions: org-scoped CRUD; platform inspectors get read-only across orgs.
ALTER TABLE "ai_predictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_predictions" FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_predictions_select ON "ai_predictions"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY ai_predictions_mutate ON "ai_predictions"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- Model registry is platform-managed; no RLS (matches feature_flags pattern).
-- Access is enforced at the application layer via getRawClient({as: ...}).
