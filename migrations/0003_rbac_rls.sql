-- ===========================================================================
-- 0003_rbac_rls.sql — RLS + permission function + effective-permissions cache
-- ===========================================================================
-- Adds, for the Sprint 3 RBAC tables:
--   * org-scoping RLS (consistent with 0001_rls_policies.sql)
--   * app_current_user_id() helper
--   * app_has_permission(code) — coarse org-level check consulting the cache
--   * recompute functions + triggers that keep effective_permissions_cache in
--     sync when role assignments, role permissions, or grants change
--
-- The cache is an ORG-COARSE projection (docs/05-multi-tenant-and-rbac.md):
-- it answers "does this user hold permission X somewhere in this org?". The
-- service-layer resolver enforces scope (workshop/department) and live time
-- windows precisely; this cache backs fast, fail-closed RLS. Hand-authored;
-- forward-only.
-- ===========================================================================

-- --- helper: current user id ------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- --- coarse permission check (consults the cache) ---------------------------
-- SECURITY DEFINER so it can read the cache regardless of the cache's own RLS
-- (the documented "bypass RLS only via SECURITY DEFINER" pattern). Always
-- filtered explicitly by the current org + user context.
CREATE OR REPLACE FUNCTION app_has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM effective_permissions_cache c
    WHERE c.organization_id = app_current_org_id()
      AND c.user_id = app_current_user_id()
      AND c.permission_code = p_code
  );
$$;

-- --- cache recompute for a single membership --------------------------------
CREATE OR REPLACE FUNCTION recompute_effective_permissions_for_membership(
  p_membership uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org  uuid;
  v_user uuid;
BEGIN
  SELECT organization_id, user_id INTO v_org, v_user
  FROM memberships WHERE id = p_membership;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM effective_permissions_cache
  WHERE organization_id = v_org AND user_id = v_user;

  INSERT INTO effective_permissions_cache (organization_id, user_id, permission_code)
  SELECT DISTINCT v_org, v_user, rp.permission_code
  FROM role_assignments ra
  JOIN role_permissions rp
    ON rp.role_id = ra.role_id AND rp.deleted_at IS NULL
  WHERE ra.membership_id = p_membership
    AND ra.deleted_at IS NULL
    AND (ra.valid_from IS NULL OR ra.valid_from <= now())
    AND (ra.valid_until IS NULL OR ra.valid_until > now())
  UNION
  SELECT DISTINCT v_org, v_user, g.permission_code
  FROM user_permission_grants g
  WHERE g.membership_id = p_membership
    AND g.kind = 'grant'
    AND g.deleted_at IS NULL
    AND (g.valid_from IS NULL OR g.valid_from <= now())
    AND (g.valid_until IS NULL OR g.valid_until > now())
  EXCEPT
  SELECT v_org, v_user, g.permission_code
  FROM user_permission_grants g
  WHERE g.membership_id = p_membership
    AND g.kind = 'deny'
    AND g.workshop_id IS NULL
    AND g.department_id IS NULL
    AND g.deleted_at IS NULL
    AND (g.valid_from IS NULL OR g.valid_from <= now())
    AND (g.valid_until IS NULL OR g.valid_until > now());
END;
$$;

-- --- cache recompute for every membership holding a given role --------------
CREATE OR REPLACE FUNCTION recompute_effective_permissions_for_role(p_role uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT membership_id
    FROM role_assignments
    WHERE role_id = p_role AND deleted_at IS NULL
  LOOP
    PERFORM recompute_effective_permissions_for_membership(r.membership_id);
  END LOOP;
END;
$$;

-- --- trigger glue -----------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recompute_from_membership_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_effective_permissions_for_membership(OLD.membership_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_effective_permissions_for_membership(NEW.membership_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_recompute_from_role_perm_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_effective_permissions_for_role(OLD.role_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_effective_permissions_for_role(NEW.role_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER role_assignments_refresh_cache
  AFTER INSERT OR UPDATE OR DELETE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_membership_row();

CREATE TRIGGER user_permission_grants_refresh_cache
  AFTER INSERT OR UPDATE OR DELETE ON user_permission_grants
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_membership_row();

CREATE TRIGGER role_permissions_refresh_cache
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_role_perm_row();

-- --- RLS on the RBAC tables (org-scoped) ------------------------------------
ALTER TABLE "roles"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles"                        FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_assignments"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_assignments"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_permission_grants"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_permission_grants"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "effective_permissions_cache"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "effective_permissions_cache"  FORCE ROW LEVEL SECURITY;

CREATE POLICY roles_select ON "roles"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY roles_mutate ON "roles"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY role_permissions_select ON "role_permissions"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY role_permissions_mutate ON "role_permissions"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY role_assignments_select ON "role_assignments"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY role_assignments_mutate ON "role_assignments"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY user_permission_grants_select ON "user_permission_grants"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY user_permission_grants_mutate ON "user_permission_grants"
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

-- Cache is read-only to tenants (writes happen via SECURITY DEFINER triggers).
CREATE POLICY effective_permissions_cache_select ON "effective_permissions_cache"
  FOR SELECT
  USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
