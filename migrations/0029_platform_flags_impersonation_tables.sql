CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"metadata" jsonb,
	"updated_by_platform_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_user_id" uuid NOT NULL,
	"target_org_id" uuid NOT NULL,
	"target_user_id" uuid,
	"reason" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_org_key_uq" ON "feature_flags" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "feature_flags_key_idx" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "platform_impersonation_sessions_user_idx" ON "platform_impersonation_sessions" USING btree ("platform_user_id","started_at");