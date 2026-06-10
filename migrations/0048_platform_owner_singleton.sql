-- Sprint 20 (Platform Maturity) — PlatformOwner singleton invariant.
--
-- Per CLAUDE.md §4.3 and docs/06-developer-control-plane.md, the PlatformOwner
-- role is a singleton. There must only ever be ONE active PlatformOwner across
-- the entire platform. Customer organizations must NEVER receive this role.
--
-- Enforcement is at the lowest possible layer (the database) so service-layer
-- bugs cannot accidentally grant a second PlatformOwner. Revoked rows are
-- explicitly allowed (succession scenario: revoke previous owner, then grant
-- to successor).

CREATE UNIQUE INDEX "platform_role_assignments_one_active_owner_idx"
  ON "platform_role_assignments" ("role")
  WHERE "role" = 'PlatformOwner' AND "revoked_at" IS NULL;

COMMENT ON INDEX "platform_role_assignments_one_active_owner_idx" IS
  'Sprint 20 invariant: at most ONE active PlatformOwner. Revoked rows allowed '
  'so the role can be transferred (revoke + grant in the same transaction).';
