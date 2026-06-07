CREATE TABLE "phone_lookups_1881" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"result" jsonb,
	"data" jsonb,
	"found_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vegvesen_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"registration_number" varchar(16) NOT NULL,
	"result" jsonb,
	"data" jsonb,
	"found_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"owner_customer_id" uuid,
	"user_customer_id" uuid,
	"ownership_type" "ownership_type" DEFAULT 'unknown' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_lookups_1881" ADD CONSTRAINT "phone_lookups_1881_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vegvesen_lookups" ADD CONSTRAINT "vegvesen_lookups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_owner_customer_id_customers_id_fk" FOREIGN KEY ("owner_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_user_customer_id_customers_id_fk" FOREIGN KEY ("user_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_lookups_1881_org_phone_idx" ON "phone_lookups_1881" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX "vegvesen_lookups_org_reg_idx" ON "vegvesen_lookups" USING btree ("organization_id","registration_number");--> statement-breakpoint
CREATE INDEX "vehicle_ownership_history_vehicle_idx" ON "vehicle_ownership_history" USING btree ("organization_id","vehicle_id");