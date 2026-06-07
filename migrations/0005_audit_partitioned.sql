-- ===========================================================================
-- 0005_audit_partitioned.sql — partitioned audit tables (hand-authored)
-- ===========================================================================
-- audit_events and platform_audit_events are partitioned by month on
-- occurred_at (docs/03-data-model.md, docs/06-developer-control-plane.md).
-- Drizzle cannot express PARTITION BY, so these are authored by hand and are
-- NOT exported from the schema barrel (queried via their table objects).
--
-- A DEFAULT partition catches any row outside the explicit monthly partitions,
-- so inserts never fail while a maintenance job adds future months. PK includes
-- the partition key (occurred_at) as Postgres requires.
-- ===========================================================================

CREATE TABLE "audit_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "organization_id" uuid NOT NULL,
  "workshop_id" uuid,
  "actor_user_id" uuid,
  "actor_kind" varchar(32) NOT NULL,
  "impersonated_user_id" uuid,
  "entity_table" varchar(128) NOT NULL,
  "entity_id" uuid NOT NULL,
  "action" varchar(64) NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "reason" text,
  "metadata" jsonb,
  "correlation_id" uuid,
  "caused_by_event_id" uuid,
  CONSTRAINT "audit_events_pk" PRIMARY KEY ("id", "occurred_at")
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
CREATE INDEX "audit_events_org_occurred_idx"
  ON "audit_events" ("organization_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx"
  ON "audit_events" ("entity_table", "entity_id");
--> statement-breakpoint
CREATE TABLE "audit_events_default" PARTITION OF "audit_events" DEFAULT;
--> statement-breakpoint
CREATE TABLE "audit_events_2026_06" PARTITION OF "audit_events"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
--> statement-breakpoint
CREATE TABLE "audit_events_2026_07" PARTITION OF "audit_events"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
--> statement-breakpoint

CREATE TABLE "platform_audit_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "platform_user_id" uuid,
  "platform_role_at_action" varchar(32),
  "target_org_id" uuid,
  "target_user_id" uuid,
  "target_entity_type" varchar(128),
  "target_entity_id" uuid,
  "action" varchar(64) NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "reason" text,
  "correlation_id" uuid,
  "metadata" jsonb,
  CONSTRAINT "platform_audit_events_pk" PRIMARY KEY ("id", "occurred_at")
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
CREATE INDEX "platform_audit_events_occurred_idx"
  ON "platform_audit_events" ("occurred_at");
--> statement-breakpoint
CREATE TABLE "platform_audit_events_default" PARTITION OF "platform_audit_events" DEFAULT;
--> statement-breakpoint
CREATE TABLE "platform_audit_events_2026_06" PARTITION OF "platform_audit_events"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
--> statement-breakpoint
CREATE TABLE "platform_audit_events_2026_07" PARTITION OF "platform_audit_events"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
