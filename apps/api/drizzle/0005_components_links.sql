CREATE TABLE "issue_components" (
	"issue_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	CONSTRAINT "issue_components_issue_id_component_id_pk" PRIMARY KEY("issue_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "issue_link_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"outward" text NOT NULL,
	"inward" text NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	CONSTRAINT "issue_link_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "issue_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_links_not_self" CHECK ("issue_links"."source_id" <> "issue_links"."target_id")
);
--> statement-breakpoint
CREATE TABLE "project_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"lead_id" uuid,
	"default_assignee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_component_id_project_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."project_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_type_id_issue_link_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."issue_link_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_source_id_issues_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_target_id_issues_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_components_component_idx" ON "issue_components" USING btree ("component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_links_unique" ON "issue_links" USING btree ("type_id","source_id","target_id");--> statement-breakpoint
CREATE INDEX "issue_links_source_idx" ON "issue_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "issue_links_target_idx" ON "issue_links" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_components_name_unique" ON "project_components" USING btree ("project_id",lower("name"));