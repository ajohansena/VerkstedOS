-- ===========================================================================
-- 0040_notifications_rls.sql — RLS for Sprint 17 notifications & portal tokens
-- ===========================================================================
-- Org-scoping consistent with prior tables. Permission gating happens at the
-- service layer (admin:config for rules, in-app for own notifications). The
-- portal_tokens table is read by an admin client (the token IS the auth);
-- RLS still enforces org-scoping for any tenant context that touches it.
-- Notifications are READ by their recipient and the org's admins (handled at
-- the service layer); RLS lets any org member SELECT within their org and
-- restricts UPDATE/DELETE to the recipient + admin paths in service code.
-- Hand-authored; forward-only.
-- ===========================================================================

ALTER TABLE "notification_rules"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_rules"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "notifications"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"             FORCE  ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries"   FORCE  ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "portal_tokens"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_tokens"             FORCE  ROW LEVEL SECURITY;

CREATE POLICY notification_rules_select ON "notification_rules"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY notification_rules_mutate ON "notification_rules"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY notifications_select ON "notifications"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY notifications_mutate ON "notifications"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY notification_deliveries_select ON "notification_deliveries"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY notification_deliveries_mutate ON "notification_deliveries"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY notification_preferences_select ON "notification_preferences"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY notification_preferences_mutate ON "notification_preferences"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());

CREATE POLICY portal_tokens_select ON "portal_tokens"
  FOR SELECT USING (organization_id = app_current_org_id() OR app_is_platform_inspector());
CREATE POLICY portal_tokens_mutate ON "portal_tokens"
  FOR ALL USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
