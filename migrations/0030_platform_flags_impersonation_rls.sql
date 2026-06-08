-- ===========================================================================
-- 0030_platform_flags_impersonation_rls.sql — RLS for Sprint 12 platform tables
-- ===========================================================================
-- Platform-managed tables: FORCE RLS with NO policy, so only the service-role
-- (admin) connection — which bypasses RLS — can read/write them. Tenant
-- (non-superuser) connections see nothing. Mirrors 0006 for platform_*.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "feature_flags"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flags"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_impersonation_sessions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_impersonation_sessions"   FORCE ROW LEVEL SECURITY;
