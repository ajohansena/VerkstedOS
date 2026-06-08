-- ===========================================================================
-- 0028_digital_signatures_rls.sql — RLS for Sprint 12 digital signatures
-- ===========================================================================
-- The signature chain is an APPEND-ONLY, tamper-evident ledger: INSERT + SELECT
-- only, no UPDATE/DELETE policy (a wrong signature is superseded by a new one,
-- never edited — editing would break the hash chain anyway). Org-scoped.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "digital_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "digital_signatures" FORCE ROW LEVEL SECURITY;

CREATE POLICY digital_signatures_select ON "digital_signatures"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY digital_signatures_insert ON "digital_signatures"
  FOR INSERT WITH CHECK (organization_id = app_current_org_id());
