CREATE TYPE "public"."absence_status" AS ENUM('requested', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_agreement_status" AS ENUM('draft', 'signed', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_reservation_status" AS ENUM('planned', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rental_vehicle_status" AS ENUM('available', 'in_service', 'maintenance', 'decommissioned');--> statement-breakpoint
CREATE TABLE "rental_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"status" "rental_agreement_status" DEFAULT 'draft' NOT NULL,
	"signature_id" uuid,
	"signed_at" timestamp with time zone,
	"signed_by_name" varchar(128),
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rental_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rental_vehicle_id" uuid NOT NULL,
	"case_id" uuid,
	"customer_id" uuid,
	"funding_source_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "rental_reservation_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rental_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"returned_at" timestamp with time zone NOT NULL,
	"odometer_km" integer,
	"fuel_level_percent" integer,
	"damage_notes" text,
	"additional_charges_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rental_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"registration_number" varchar(16) NOT NULL,
	"make" varchar(64),
	"model" varchar(64),
	"daily_rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"status" "rental_vehicle_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "status" "absence_status" DEFAULT 'requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD COLUMN "declined_reason" text;--> statement-breakpoint
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_reservation_id_rental_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."rental_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_reservations" ADD CONSTRAINT "rental_reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_reservations" ADD CONSTRAINT "rental_reservations_rental_vehicle_id_rental_vehicles_id_fk" FOREIGN KEY ("rental_vehicle_id") REFERENCES "public"."rental_vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_reservations" ADD CONSTRAINT "rental_reservations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_reservations" ADD CONSTRAINT "rental_reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_reservations" ADD CONSTRAINT "rental_reservations_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_returns" ADD CONSTRAINT "rental_returns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_returns" ADD CONSTRAINT "rental_returns_agreement_id_rental_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."rental_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_vehicles" ADD CONSTRAINT "rental_vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_vehicles" ADD CONSTRAINT "rental_vehicles_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_agreements_reservation_idx" ON "rental_agreements" USING btree ("organization_id","reservation_id");--> statement-breakpoint
CREATE INDEX "rental_agreements_status_idx" ON "rental_agreements" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "rental_reservations_vehicle_idx" ON "rental_reservations" USING btree ("organization_id","rental_vehicle_id","starts_at");--> statement-breakpoint
CREATE INDEX "rental_reservations_case_idx" ON "rental_reservations" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "rental_reservations_status_idx" ON "rental_reservations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "rental_returns_agreement_idx" ON "rental_returns" USING btree ("organization_id","agreement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_vehicles_org_regno_uq" ON "rental_vehicles" USING btree ("organization_id","registration_number");--> statement-breakpoint
CREATE INDEX "rental_vehicles_org_status_idx" ON "rental_vehicles" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "absence_entries" ADD CONSTRAINT "absence_entries_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absence_entries" ADD CONSTRAINT "absence_entries_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_entries_org_status_idx" ON "absence_entries" USING btree ("organization_id","status");