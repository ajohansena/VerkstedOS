CREATE TYPE "public"."ai_model_provider" AS ENUM('internal', 'openai_compatible', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ai_model_status" AS ENUM('active', 'shadow', 'retired');--> statement-breakpoint
CREATE TYPE "public"."ai_prediction_kind" AS ENUM('delay_risk', 'eta_estimate', 'cross_workshop_transfer', 'photo_damage_classification', 'parts_suggestion', 'generic');--> statement-breakpoint
CREATE TABLE "ai_model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"version" varchar(64) NOT NULL,
	"provider" "ai_model_provider" NOT NULL,
	"status" "ai_model_status" DEFAULT 'shadow' NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"registered_by_platform_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ai_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"model_key" varchar(64) NOT NULL,
	"model_version" varchar(64) NOT NULL,
	"kind" "ai_prediction_kind" NOT NULL,
	"subject_type" varchar(32) NOT NULL,
	"subject_id" uuid NOT NULL,
	"inputs" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"rationale" text,
	"confidence" numeric(5, 4),
	"latency_ms" integer,
	"cost_micro_usd" integer,
	"ground_truth" jsonb,
	"ground_truth_captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_versions_key_version_uq" ON "ai_model_versions" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "ai_model_versions_status_idx" ON "ai_model_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_predictions_org_idx" ON "ai_predictions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_predictions_model_idx" ON "ai_predictions" USING btree ("model_key","model_version");--> statement-breakpoint
CREATE INDEX "ai_predictions_subject_idx" ON "ai_predictions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "ai_predictions_kind_idx" ON "ai_predictions" USING btree ("kind");