CREATE TYPE "public"."vehicle_movement_reason" AS ENUM('arrival', 'reposition', 'into_bay', 'out_of_bay', 'into_storage', 'departure', 'correction');--> statement-breakpoint
CREATE TYPE "public"."yard_location_kind" AS ENUM('parking', 'bay', 'storage', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."yard_location_status" AS ENUM('available', 'occupied', 'reserved', 'blocked');--> statement-breakpoint
CREATE TABLE "vehicle_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid NOT NULL,
	"reason" "vehicle_movement_reason" DEFAULT 'reposition' NOT NULL,
	"moved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moved_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "yard_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "yard_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"kind" "yard_location_kind" DEFAULT 'parking' NOT NULL,
	"status" "yard_location_status" DEFAULT 'available' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"row_index" integer DEFAULT 0 NOT NULL,
	"column_index" integer DEFAULT 0 NOT NULL,
	"qr_tag" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_from_location_id_yard_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."yard_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_to_location_id_yard_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."yard_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_moved_by_user_id_users_id_fk" FOREIGN KEY ("moved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_placements" ADD CONSTRAINT "vehicle_placements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_placements" ADD CONSTRAINT "vehicle_placements_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_placements" ADD CONSTRAINT "vehicle_placements_location_id_yard_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."yard_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_layouts" ADD CONSTRAINT "yard_layouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_layouts" ADD CONSTRAINT "yard_layouts_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_locations" ADD CONSTRAINT "yard_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_locations" ADD CONSTRAINT "yard_locations_layout_id_yard_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."yard_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_movements_case_idx" ON "vehicle_movements" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "vehicle_movements_org_idx" ON "vehicle_movements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_movements_to_idx" ON "vehicle_movements" USING btree ("to_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_placements_case_uq" ON "vehicle_placements" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "vehicle_placements_location_idx" ON "vehicle_placements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "vehicle_placements_org_idx" ON "vehicle_placements" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "yard_layouts_org_code_uq" ON "yard_layouts" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "yard_layouts_workshop_idx" ON "yard_layouts" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "yard_locations_layout_code_uq" ON "yard_locations" USING btree ("layout_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "yard_locations_org_qr_uq" ON "yard_locations" USING btree ("organization_id","qr_tag");--> statement-breakpoint
CREATE INDEX "yard_locations_org_status_idx" ON "yard_locations" USING btree ("organization_id","status");