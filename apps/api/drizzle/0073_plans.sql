CREATE TABLE "plan_capacities" (
	"plan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"month" date NOT NULL,
	"points" real NOT NULL,
	CONSTRAINT "plan_capacities_plan_id_project_id_month_pk" PRIMARY KEY("plan_id","project_id","month")
);
--> statement-breakpoint
CREATE TABLE "plan_projects" (
	"plan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	CONSTRAINT "plan_projects_plan_id_project_id_pk" PRIMARY KEY("plan_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "plan_scenario_changes" (
	"scenario_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"change" jsonb NOT NULL,
	"base_updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "plan_scenario_changes_scenario_id_issue_id_pk" PRIMARY KEY("scenario_id","issue_id")
);
--> statement-breakpoint
CREATE TABLE "plan_scenarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tql" text DEFAULT '' NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_capacities" ADD CONSTRAINT "plan_capacities_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_capacities" ADD CONSTRAINT "plan_capacities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_projects" ADD CONSTRAINT "plan_projects_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_projects" ADD CONSTRAINT "plan_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_scenario_changes" ADD CONSTRAINT "plan_scenario_changes_scenario_id_plan_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."plan_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_scenario_changes" ADD CONSTRAINT "plan_scenario_changes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_scenarios" ADD CONSTRAINT "plan_scenarios_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_scenarios" ADD CONSTRAINT "plan_scenarios_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;