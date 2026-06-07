-- ===========================================================================
-- 0001_rls_policies.sql — Row-Level Security for Sprint 2 foundation tables
-- ===========================================================================
-- Defense-in-depth (docs/03-data-model.md § RLS strategy, CLAUDE.md § 4.2).
-- Service-layer permission checks are the primary authz layer; these policies
-- are the database-level backstop. Org-scoping only this sprint; permission-
-- based policies (app.has_permission) are layered in Sprint 4 once RBAC exists.
--
-- Authored by hand and applied alongside the Drizzle migration. Forward-only.
-- ===========================================================================

-- --- Helper functions (read session vars set by the tenant-aware client) ----
-- The tenant-aware Drizzle client runs `SET LOCAL app.current_org_id = '…'`
-- (and friends) at transaction start. These STABLE helpers read those vars.
-- `current_setting(…, true)` returns NULL (instead of erroring) when unset.

CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_is_platform_inspector()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.is_platform_inspector', true), '')::boolean,
    false
  );
$$;

-- --- Enable RLS + FORCE (so even the table owner is subject to policies) -----

ALTER TABLE "organizations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "workshops"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshops"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "workshop_departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshop_departments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "memberships"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "customers"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicles"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "users"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "insurance_companies"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insurance_companies"  FORCE ROW LEVEL SECURITY;

-- ===========================================================================
-- Org-scoped tables: organization_id must equal the current org context.
-- A platform inspector (read-only) may SELECT across orgs.
-- ===========================================================================

-- organizations: the row's own id IS the org id.
CREATE POLICY organizations_select ON "organizations"
  FOR SELECT
  USING (id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY organizations_mutate ON "organizations"
  FOR ALL
  USING (id = app_current_org_id())
  WITH CHECK (id = app_current_org_id());

-- Generic org-scoped tables.
CREATE POLICY workshops_select ON "workshops"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY workshops_mutate ON "workshops"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY workshop_departments_select ON "workshop_departments"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY workshop_departments_mutate ON "workshop_departments"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY memberships_select ON "memberships"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY memberships_mutate ON "memberships"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY customers_select ON "customers"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY customers_mutate ON "customers"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY vehicles_select ON "vehicles"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY vehicles_mutate ON "vehicles"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- ===========================================================================
-- users: global identity. A user row is visible if it shares a membership with
-- the current org, or to a platform inspector. Writes are service/platform only
-- (no org-scoped UPDATE policy → app-layer + platform handle user mutations).
-- ===========================================================================

CREATE POLICY users_select ON "users"
  FOR SELECT
  USING (
    app_is_platform_inspector()
    OR EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m.user_id = users.id
        AND m.organization_id = app_current_org_id()
    )
  );

-- ===========================================================================
-- insurance_companies: platform-shared catalog. Read-only to every tenant;
-- writes only via platform/seed path (no tenant write policy).
-- ===========================================================================

CREATE POLICY insurance_companies_select ON "insurance_companies"
  FOR SELECT
  USING (true);
