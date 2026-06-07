CREATE TYPE "public"."actor_kind" AS ENUM('user', 'system', 'integration', 'job', 'platform', 'platform_impersonation');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('PlatformOwner', 'PlatformDeveloper', 'PlatformSupport');--> statement-breakpoint
CREATE TYPE "public"."platform_user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "failed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_event_id" uuid,
	"event_type" varchar(128) NOT NULL,
	"organization_id" uuid,
	"payload" jsonb NOT NULL,
	"consumer" varchar(128),
	"error" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"replayed_from_id" uuid,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"organization_id" uuid,
	"workshop_id" uuid,
	"actor_kind" varchar(32) NOT NULL,
	"actor_id" uuid,
	"correlation_id" uuid,
	"causation_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "platform_permissions" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_user_id" uuid NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "platform_role_permissions" (
	"role" "platform_role" NOT NULL,
	"permission_code" varchar(64) NOT NULL,
	CONSTRAINT "platform_role_permissions_pk" PRIMARY KEY("role","permission_code")
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "platform_user_status" DEFAULT 'active' NOT NULL,
	"added_by_user_id" uuid,
	"notes" text,
	"two_factor_enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_users_user_uq" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_platform_user_id_platform_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "failed_events_type_idx" ON "failed_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "outbox_events_status_idx" ON "outbox_events" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE INDEX "outbox_events_org_idx" ON "outbox_events" USING btree ("organization_id");