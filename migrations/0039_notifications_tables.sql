CREATE TYPE "public"."notification_category" AS ENUM('parts_delay', 'supplement_pending', 'delivery_at_risk', 'missing_photos', 'capacity_conflict', 'customer_pending', 'inbound_message', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'sent', 'failed', 'bounced', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."portal_token_scope" AS ENUM('case_status', 'case_acceptance', 'delivery_signoff');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"address" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"provider_status" text,
	"error_message" text,
	"attempted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"category" "notification_category" NOT NULL,
	"severity" "notification_severity" DEFAULT 'warning' NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"channels" "notification_channel"[] NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"recipient_user_id" uuid NOT NULL,
	"rule_code" varchar(64),
	"category" "notification_category" NOT NULL,
	"severity" "notification_severity" NOT NULL,
	"ref_type" varchar(32) NOT NULL,
	"ref_id" uuid,
	"title_key" varchar(64) NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_url" text,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "portal_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"scope" "portal_token_scope" NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"first_used_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"sent_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tokens" ADD CONSTRAINT "portal_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tokens" ADD CONSTRAINT "portal_tokens_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" USING btree ("organization_id","notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_uq" ON "notification_preferences" USING btree ("organization_id","user_id","category","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_org_code_uq" ON "notification_rules" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "notification_rules_org_enabled_idx" ON "notification_rules" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedup_uq" ON "notifications" USING btree ("organization_id","recipient_user_id","rule_code","ref_type","ref_id") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE INDEX "notifications_recipient_status_idx" ON "notifications" USING btree ("organization_id","recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_org_created_idx" ON "notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_tokens_token_uq" ON "portal_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "portal_tokens_case_scope_idx" ON "portal_tokens" USING btree ("case_id","scope");