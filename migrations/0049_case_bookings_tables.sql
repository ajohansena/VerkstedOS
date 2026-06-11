CREATE TYPE "public"."case_booking_status" AS ENUM('tentative', 'confirmed', 'arrived', 'cancelled');--> statement-breakpoint
CREATE TABLE "case_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"status" "case_booking_status" DEFAULT 'tentative' NOT NULL,
	"expected_arrival_at" timestamp with time zone,
	"promised_delivery_at" timestamp with time zone,
	"notes" text,
	"cancelled_reason" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" uuid,
	"arrived_at" timestamp with time zone,
	"arrived_confirmed_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_bookings" ADD CONSTRAINT "case_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_bookings" ADD CONSTRAINT "case_bookings_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_bookings" ADD CONSTRAINT "case_bookings_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_bookings_case_idx" ON "case_bookings" USING btree ("organization_id","case_id","status");--> statement-breakpoint
CREATE INDEX "case_bookings_workshop_arrival_idx" ON "case_bookings" USING btree ("organization_id","workshop_id","expected_arrival_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_bookings_one_active_per_case_uq" ON "case_bookings" USING btree ("case_id") WHERE status in ('tentative','confirmed','arrived');