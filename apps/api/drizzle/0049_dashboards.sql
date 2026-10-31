ALTER TYPE "public"."favourite_kind" ADD VALUE 'dashboard';--> statement-breakpoint
CREATE TABLE "dashboard_gadgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"column" integer NOT NULL,
	"position" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_homes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"type" "filter_share_type" NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"project_id" uuid,
	CONSTRAINT "dashboard_shares_unique" UNIQUE NULLS NOT DISTINCT("dashboard_id","type","user_id","group_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"layout" text DEFAULT 'two' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_gadgets" ADD CONSTRAINT "dashboard_gadgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_homes" ADD CONSTRAINT "dashboard_homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_homes" ADD CONSTRAINT "dashboard_homes_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_gadgets_dashboard_idx" ON "dashboard_gadgets" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "dashboard_shares_dashboard_idx" ON "dashboard_shares" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "dashboards_owner_idx" ON "dashboards" USING btree ("owner_id");