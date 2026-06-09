CREATE TYPE "public"."kpi_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."kpi_period" AS ENUM('day', 'week', 'month', 'rolling_30');--> statement-breakpoint
CREATE TYPE "public"."kpi_unit" AS ENUM('count', 'days', 'percent', 'currency', 'hours');--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"metric_code" varchar(64) NOT NULL,
	"unit" "kpi_unit" NOT NULL,
	"direction" "kpi_direction" DEFAULT 'up' NOT NULL,
	"target_value" numeric(14, 2),
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"kpi_code" varchar(64) NOT NULL,
	"period" "kpi_period" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"sample_size" numeric(12, 0),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_definitions_org_code_uq" ON "kpi_definitions" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "kpi_definitions_org_category_idx" ON "kpi_definitions" USING btree ("organization_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_snapshots_unique" ON "kpi_snapshots" USING btree ("organization_id","workshop_id","kpi_code","period","period_start") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE INDEX "kpi_snapshots_series_idx" ON "kpi_snapshots" USING btree ("organization_id","kpi_code","period_start");