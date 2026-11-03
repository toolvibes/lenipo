CREATE TABLE "request_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"issue_type_id" uuid NOT NULL,
	"fields" text[] DEFAULT '{}' NOT NULL,
	"position" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"group_id" uuid
);
--> statement-breakpoint
CREATE TABLE "service_desks" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"customer_access" text DEFAULT 'list' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"first_response_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pause_status_ids" uuid[] DEFAULT '{}' NOT NULL,
	"time_zone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"day_start_hour" integer DEFAULT 9 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_comments" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "request_type_id" uuid;--> statement-breakpoint
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_project_id_service_desks_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."service_desks"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_customers" ADD CONSTRAINT "service_customers_project_id_service_desks_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."service_desks"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_customers" ADD CONSTRAINT "service_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_customers" ADD CONSTRAINT "service_customers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_desks" ADD CONSTRAINT "service_desks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;